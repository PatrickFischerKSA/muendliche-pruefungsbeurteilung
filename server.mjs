import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const app = express();

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

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "Unbekannter Serverfehler.",
  });
});

app.listen(PORT, () => {
  console.log(`Mündliche Prüfungsbeurteilung läuft auf http://localhost:${PORT}`);
});
