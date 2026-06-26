import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { interpretationParadigms } from "./interpretationsparadigmen.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const EVAL_MODEL = process.env.OPENAI_EVAL_MODEL || "gpt-5-mini";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 80 * 1024 * 1024,
    files: 3,
  },
});

export const app = express();

app.use(
  cors({
    origin(origin, callback) {
      const configured = (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (!origin || configured.length === 0 || configured.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin nicht erlaubt: ${origin}`));
    },
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

function requireOpenAIKey() {
  if (!OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY fehlt. Bitte .env anlegen oder Umgebungsvariable setzen.");
    error.status = 500;
    throw error;
  }
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(1, Math.min(5, Math.round(score)));
}

function textValue(value, fallback = "-") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function paragraph(text = "", options = {}) {
  return new Paragraph({
    ...options,
    children: [new TextRun(textValue(text, ""))],
  });
}

function heading(text, level = HeadingLevel.HEADING_2) {
  return paragraph(text, {
    heading: level,
    spacing: { before: 280, after: 120 },
  });
}

function cell(text, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: textValue(text), bold })],
      }),
    ],
  });
}

function table(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((header) => cell(header, true)),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((value) => cell(value)),
          })
      ),
    ],
  });
}

function buildWordDocument(payload) {
  const isKi = payload.type === "ki";
  const title = isKi ? "KI-gestützte Prüfungsbeurteilung" : "Beurteilung mündlicher Prüfungen";
  const children = [
    heading(title, HeadingLevel.TITLE),
    paragraph(`Kandidat:in: ${textValue(payload.studentName)}`),
    paragraph(`Datum: ${textValue(payload.assessmentDate)}`),
    paragraph(`Exportiert am: ${new Date().toLocaleString("de-CH")}`),
    heading("Ergebnis"),
    paragraph(`Schweizer Note: ${textValue(payload.grade)}`),
    paragraph(`Punktedurchschnitt: ${textValue(payload.average)}; ungerundete Note: ${textValue(payload.rawGrade)}; Rundung: mathematisch auf halbe Noten.`),
  ];

  if (isKi) {
    children.push(
      paragraph(`Textstelle: ${textValue(payload.passageFile)}`),
      paragraph(`Gesamtes Werk: ${textValue(payload.workFile)}`)
    );
  }

  children.push(
    heading(isKi ? "Bewertung nach Kriterien" : "Kriterien"),
    table(
      isKi ? ["Kriterium", "Punkte", "Stufe", "Begründung"] : ["Kriterium", "Orientierung", "Punkte", "Stufe"],
      (payload.criteria || []).map((entry) =>
        isKi
          ? [entry.criterion, entry.score, entry.level, entry.comment]
          : [entry.criterion, entry.help, entry.score, entry.level]
      )
    ),
    heading(isKi ? "Gesamtkommentar" : "Kommentar"),
    paragraph(payload.overallComment || payload.comment || "-")
  );

  if (isKi) {
    children.push(
      heading("Notizen zur Aufgabenstellung"),
      paragraph(payload.taskNotes || "-"),
      heading("Transkript"),
      paragraph(payload.transcript || "-")
    );
  }

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

async function createWordBuffer(payload) {
  const document = buildWordDocument(payload);
  return Packer.toBuffer(document);
}

function fileByField(req, fieldname) {
  if (!req.files) return null;
  if (Array.isArray(req.files)) {
    return req.files.find((file) => file.fieldname === fieldname) || null;
  }
  return req.files[fieldname]?.[0] || null;
}

async function extractTextFromFile(file) {
  if (!file) return "";

  const name = file.originalname || "";
  const mime = file.mimetype || "";
  const lower = name.toLowerCase();

  if (mime.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    return file.buffer.toString("utf8");
  }

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const { default: pdfParse } = await import("pdf-parse");
      const parsed = await pdfParse(file.buffer);
      return parsed.text || "";
    } catch (error) {
      return `[PDF konnte nicht extrahiert werden: ${error.message}]`;
    }
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    try {
      const { default: mammoth } = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer: file.buffer });
      return parsed.value || "";
    } catch (error) {
      return `[DOCX konnte nicht extrahiert werden: ${error.message}]`;
    }
  }

  if (mime === "application/msword" || lower.endsWith(".doc")) {
    try {
      const { default: WordExtractor } = await import("word-extractor");
      const extractor = new WordExtractor();
      const parsed = await extractor.extract(file.buffer);
      return parsed.getBody() || "";
    } catch (error) {
      return `[DOC konnte nicht extrahiert werden: ${error.message}]`;
    }
  }

  return `[${name || "Datei"}: Text konnte nicht automatisch extrahiert werden.]`;
}

async function transcribeAudio(audioFile) {
  requireOpenAIKey();
  if (!audioFile) {
    const error = new Error("Keine Audiodatei erhalten.");
    error.status = 400;
    throw error;
  }

  const formData = new FormData();
  const audioBlob = new Blob([audioFile.buffer], { type: audioFile.mimetype || "audio/webm" });
  formData.append("file", audioBlob, audioFile.originalname || "pruefung.webm");
  formData.append("model", TRANSCRIBE_MODEL);
  formData.append("language", "de");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI-Transkription fehlgeschlagen (${response.status}): ${details}`);
  }

  const json = await response.json();
  return json.text || json.transcript || "";
}

function buildEvaluationPrompt({ transcript, passageText, workText, taskNotes, criteria }) {
  return [
    {
      role: "system",
      content:
        "Du bist eine sorgfältige Schweizer Deutschlehrperson. Bewerte eine mündliche Prüfung fair, streng und nachvollziehbar. Verwende nur die fünf vorgegebenen Kriterien. Gib keine personenbezogenen Mutmassungen ab. Wenn die Evidenz im Transkript fehlt, bewerte vorsichtig und benenne die Unsicherheit.",
    },
    {
      role: "user",
      content: [
        "Bewerte das folgende Prüfungstranskript nach den Kriterien.",
        "",
        "Punkteskala je Kriterium: 1 bis 5. 1 = sehr schwach, 5 = sehr stark. Die Schweizer Note berechnet das Frontend.",
        "",
        "Kriterien mit Wertbeschreibungen:",
        JSON.stringify(criteria, null, 2),
        "",
        "Interpretationsparadigmen als fachlicher Hintergrund:",
        JSON.stringify(interpretationParadigms, null, 2),
        "",
        "Nutze diese Paradigmen als Bewertungsfolie: Die Kommentare sollen sichtbar machen, ob die gepruefte Person textnah interpretiert, tragfaehig argumentiert, relevante Kontexte einbezieht und Fehlschluesse vermeidet. Bewerte aber weiterhin nur nach den fuenf vorgegebenen Kriterien.",
        "",
        "Aufgaben-/Kontextnotizen:",
        taskNotes || "Keine.",
        "",
        "Textstelle:",
        passageText || "Nicht bereitgestellt.",
        "",
        "Gesamtes Werk / Auszug:",
        workText || "Nicht bereitgestellt.",
        "",
        "Transkript:",
        transcript || "Kein Transkript vorhanden.",
        "",
        "Antworte als JSON gemäss Schema. Jeder Kommentar soll knapp, konkret und auf das Transkript bezogen sein.",
      ].join("\n"),
    },
  ];
}

const evaluationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overallComment", "assessment"],
  properties: {
    overallComment: {
      type: "string",
      description: "Kurzer Gesamtkommentar zur mündlichen Prüfung.",
    },
    assessment: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterion", "score", "comment"],
        properties: {
          criterion: { type: "string" },
          score: { type: "integer", minimum: 1, maximum: 5 },
          comment: { type: "string" },
        },
      },
    },
  },
};

async function evaluateTranscript({ transcript, passageText, workText, taskNotes, criteria }) {
  requireOpenAIKey();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EVAL_MODEL,
      input: buildEvaluationPrompt({ transcript, passageText, workText, taskNotes, criteria }),
      text: {
        format: {
          type: "json_schema",
          name: "oral_exam_assessment",
          schema: evaluationSchema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI-Bewertung fehlgeschlagen (${response.status}): ${details}`);
  }

  const json = await response.json();
  const outputText =
    json.output_text ||
    json.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n");

  if (!outputText) throw new Error("OpenAI-Bewertung enthielt keinen JSON-Text.");

  const parsed = JSON.parse(outputText);
  parsed.assessment = (parsed.assessment || []).map((entry) => ({
    criterion: entry.criterion,
    score: clampScore(entry.score),
    comment: entry.comment || "",
  }));
  return parsed;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    transcribeModel: TRANSCRIBE_MODEL,
    evaluationModel: EVAL_MODEL,
    hasOpenAIKey: Boolean(OPENAI_API_KEY),
  });
});

app.post(
  "/api/muendliche-pruefung",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "passage", maxCount: 1 },
    { name: "work", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const task = req.body.task;
      const criteria = parseJsonField(req.body.criteria, []);
      const audioFile = fileByField(req, "audio");
      const passageFile = fileByField(req, "passage");
      const workFile = fileByField(req, "work");

      if (task === "transcribe") {
        const transcript = await transcribeAudio(audioFile);
        res.json({ transcript });
        return;
      }

      if (task === "evaluate") {
        const passageText = await extractTextFromFile(passageFile);
        const workText = await extractTextFromFile(workFile);
        const result = await evaluateTranscript({
          transcript: req.body.transcript || "",
          passageText,
          workText,
          taskNotes: req.body.taskNotes || "",
          criteria,
        });
        res.json(result);
        return;
      }

      res.status(400).json({ error: "Unbekannte task. Erlaubt sind transcribe oder evaluate." });
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/export-word", async (req, res, next) => {
  try {
    const buffer = await createWordBuffer(req.body || {});
    const filename = req.body?.filename || "pruefungsbeurteilung.docx";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "-")}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "Unbekannter Serverfehler.",
  });
});

if (!process.env.VERCEL && process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Mündliche Prüfungsbeurteilung läuft auf http://localhost:${PORT}`);
  });
}
