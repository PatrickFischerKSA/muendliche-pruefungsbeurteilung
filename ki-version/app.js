const criteria = [
  {
    title: "Eigene Interpretation / Erklärungsansätze",
    help: "Entwickelt eigenständige Deutungen und macht nachvollziehbar, wie diese aus Text, Material oder Thema entstehen.",
    levels: ["keine Deutung", "vage Ansätze", "plausibel", "eigenständig", "originell fundiert"],
  },
  {
    title: "Kann im Gespräch eigene Interpretationsansätze entwickeln",
    help: "Greift Impulse auf, denkt sichtbar weiter und kann den eigenen Ansatz im Dialog präzisieren oder erweitern.",
    levels: ["blockiert", "reagiert knapp", "entwickelt mit", "denkt weiter", "führt souverän"],
  },
  {
    title: "Antworten auf Fragen",
    help: "Reagiert sachbezogen, vollständig und flexibel auf Nachfragen; Unsicherheiten werden reflektiert statt ausgewichen.",
    levels: ["weicht aus", "teilweise passend", "meist treffend", "klar und flexibel", "präzis und sicher"],
  },
  {
    title: "Argumentationsfähigkeit",
    help: "Begründet Aussagen schlüssig, setzt Belege sinnvoll ein und verbindet Einzelbeobachtungen zu einer tragfähigen Linie.",
    levels: ["unbegründet", "lose Behauptungen", "nachvollziehbar", "schlüssig belegt", "stringent verknüpft"],
  },
  {
    title: "Sprache",
    help: "Spricht verständlich, präzise und fachsprachlich angemessen; Ausdruck und Struktur unterstützen die Gedankenführung.",
    levels: ["unklar", "stockend", "verständlich", "präzise", "gewandt"],
  },
];

const gradeRoundingStep = 0.5;
const state = {
  audioBlob: null,
  audioMimeType: "",
  chunks: [],
  mediaRecorder: null,
  recordingStartedAt: 0,
  timerId: null,
  recognition: null,
  recognizing: false,
  result: null,
};

const els = {
  status: document.querySelector("#statusStrip"),
  studentName: document.querySelector("#studentName"),
  assessmentDate: document.querySelector("#assessmentDate"),
  endpointUrl: document.querySelector("#endpointUrl"),
  passageFile: document.querySelector("#passageFile"),
  workFile: document.querySelector("#workFile"),
  passageInfo: document.querySelector("#passageInfo"),
  workInfo: document.querySelector("#workInfo"),
  taskNotes: document.querySelector("#taskNotes"),
  startExamButton: document.querySelector("#startExamButton"),
  finishExamButton: document.querySelector("#finishExamButton"),
  recordButton: document.querySelector("#recordButton"),
  stopButton: document.querySelector("#stopButton"),
  speechButton: document.querySelector("#speechButton"),
  speechHint: document.querySelector("#speechHint"),
  timer: document.querySelector("#timer"),
  audioPlayer: document.querySelector("#audioPlayer"),
  transcript: document.querySelector("#transcript"),
  transcribeButton: document.querySelector("#transcribeButton"),
  evaluateButton: document.querySelector("#evaluateButton"),
  rubricList: document.querySelector("#rubricList"),
  finalGrade: document.querySelector("#finalGrade"),
  overallComment: document.querySelector("#overallComment"),
  exportButton: document.querySelector("#exportButton"),
  clearButton: document.querySelector("#clearButton"),
};

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
}

function formatGrade(value) {
  if (value == null || Number.isNaN(value)) return "–";
  return Number(value.toFixed(2)).toLocaleString("de-CH", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function pointsToSwissGrade(pointsAverage) {
  return 1 + ((pointsAverage - 1) * 5) / 4;
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nl2br(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function safeFileName(value) {
  return (value || "ki-pruefungsbeurteilung").trim().replace(/[^a-z0-9_-]+/gi, "-");
}

function downloadWordDocument({ filename, title, body }) {
  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="de">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f252d; line-height: 1.45; }
    h1 { font-size: 24pt; margin: 0 0 16pt; }
    h2 { font-size: 15pt; margin: 18pt 0 8pt; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0 16pt; }
    th, td { border: 1px solid #9aa6b2; padding: 6pt; vertical-align: top; }
    th { background: #eef3f5; font-weight: bold; }
    .meta { margin-bottom: 14pt; }
    .grade { font-size: 18pt; font-weight: bold; }
    .muted { color: #5f6c78; }
  </style>
</head>
<body>${body}</body>
</html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function renderEmptyRubric() {
  els.rubricList.innerHTML = "";
  criteria.forEach((criterion) => {
    const item = document.createElement("article");
    item.className = "criterion-result";
    item.innerHTML = `
      <header>
        <strong>${criterion.title}</strong>
        <span class="score-pill">–</span>
      </header>
      <p>${criterion.help}</p>
    `;
    els.rubricList.append(item);
  });
}

function renderAssessment(assessment = []) {
  els.rubricList.innerHTML = "";
  const scores = [];

  criteria.forEach((criterion, index) => {
    const entry = assessment.find((item) => item.criterion === criterion.title || item.kriterium === criterion.title) || {};
    const score = Number(entry.score ?? entry.punkte);
    if (Number.isFinite(score)) scores.push(score);
    const levelText = Number.isFinite(score) ? criterion.levels[Math.max(0, Math.min(4, Math.round(score) - 1))] : "nicht bewertet";
    const comment = entry.comment || entry.begruendung || entry.evidence || "Noch keine KI-Begründung vorhanden.";
    const item = document.createElement("article");
    item.className = "criterion-result";
    item.innerHTML = `
      <header>
        <strong>${criterion.title}</strong>
        <span class="score-pill">${Number.isFinite(score) ? `${score} · ${levelText}` : "–"}</span>
      </header>
      <p>${comment}</p>
    `;
    els.rubricList.append(item);
  });

  if (scores.length === criteria.length) {
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    els.finalGrade.textContent = formatGrade(roundToStep(pointsToSwissGrade(average), gradeRoundingStep));
  } else {
    els.finalGrade.textContent = "–";
  }
}

function fileLabel(file) {
  if (!file) return "Keine Datei gewählt.";
  const size = `${Math.round(file.size / 1024)} KB`;
  const lower = file.name.toLowerCase();
  const kind = lower.endsWith(".pdf") ? "PDF" : lower.endsWith(".doc") || lower.endsWith(".docx") ? "Word" : "Datei";
  return `${file.name} · ${kind} · ${size}`;
}

function updateFileLabels() {
  els.passageInfo.textContent = fileLabel(els.passageFile.files[0]);
  els.workInfo.textContent = fileLabel(els.workFile.files[0]);
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function startTimer() {
  state.recordingStartedAt = Date.now();
  state.timerId = window.setInterval(() => {
    els.timer.textContent = formatTime(Date.now() - state.recordingStartedAt);
  }, 250);
}

function stopTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
}

function getRecordingSupport() {
  return {
    hasMediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
    hasGetUserMedia: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    hasMediaRecorder: typeof window !== "undefined" && Boolean(window.MediaRecorder),
    isSecureContext: typeof window !== "undefined" && Boolean(window.isSecureContext),
  };
}

async function startRecording({ integrated = false } = {}) {
  const support = getRecordingSupport();
  if (!support.hasGetUserMedia || !support.hasMediaRecorder) {
    setStatus("Audioaufnahme wird von diesem Browser nicht unterstützt oder ist hier blockiert.", true);
    return false;
  }
  if (!support.isSecureContext) {
    setStatus("Audioaufnahme braucht HTTPS oder localhost.", true);
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.chunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) state.chunks.push(event.data);
    });
    state.mediaRecorder.addEventListener("stop", () => {
      state.audioMimeType = state.mediaRecorder.mimeType || "audio/webm";
      state.audioBlob = new Blob(state.chunks, { type: state.audioMimeType });
      els.audioPlayer.src = URL.createObjectURL(state.audioBlob);
      stream.getTracks().forEach((track) => track.stop());
      setStatus("Aufnahme gespeichert. Jetzt transkribieren oder Transkript manuell ergänzen.");
    });
    state.mediaRecorder.start();
    els.recordButton.disabled = true;
    els.stopButton.disabled = false;
    els.startExamButton.disabled = true;
    els.finishExamButton.disabled = false;
    startTimer();
    setStatus(integrated ? "Prüfung läuft: Audioaufnahme und Auswertungsvorbereitung aktiv." : "Aufnahme läuft.");
    return true;
  } catch (error) {
    setStatus(`Mikrofonzugriff fehlgeschlagen: ${error.message}`, true);
    return false;
  }
}

function stopRecording() {
  return new Promise((resolve) => {
    if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
      resolve(false);
      return;
    }

    const recorder = state.mediaRecorder;
    recorder.addEventListener("stop", () => resolve(true), { once: true });
    recorder.stop();
    els.recordButton.disabled = false;
    els.stopButton.disabled = true;
    els.startExamButton.disabled = false;
    els.finishExamButton.disabled = true;
    stopTimer();
  });
}

function initSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    els.speechButton.disabled = true;
    els.speechHint.textContent = "Live-Transkript wird von diesem Browser nicht unterstützt.";
    return;
  }

  state.recognition = new Recognition();
  state.recognition.lang = "de-CH";
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.addEventListener("result", (event) => {
    let text = "";
    for (let index = 0; index < event.results.length; index += 1) {
      text += `${event.results[index][0].transcript} `;
    }
    els.transcript.value = text.trim();
  });
  state.recognition.addEventListener("end", () => {
    if (!state.recognizing) return;
    state.recognition.start();
  });
}

function toggleSpeechRecognition() {
  if (!state.recognition) return;
  state.recognizing = !state.recognizing;
  if (state.recognizing) {
    state.recognition.start();
    els.speechButton.textContent = "Live-Transkript stoppen";
    setStatus("Live-Transkript läuft. Die Audioaufnahme separat starten, wenn die Prüfung gespeichert werden soll.");
  } else {
    state.recognition.stop();
    els.speechButton.textContent = "Live-Transkript";
    setStatus("Live-Transkript gestoppt.");
  }
}

function startSpeechRecognitionForExam() {
  if (!state.recognition || state.recognizing) return false;
  try {
    state.recognizing = true;
    state.recognition.start();
    els.speechButton.textContent = "Live-Transkript stoppen";
    return true;
  } catch {
    state.recognizing = false;
    return false;
  }
}

function stopSpeechRecognitionForExam() {
  if (!state.recognition || !state.recognizing) return;
  state.recognizing = false;
  state.recognition.stop();
  els.speechButton.textContent = "Nur Live-Transkript";
}

function ensureEndpoint() {
  const endpoint = els.endpointUrl.value.trim();
  if (!endpoint) {
    setStatus("Bitte zuerst einen Backend-Endpunkt eintragen.", true);
    return "";
  }
  return endpoint;
}

function buildPayload(task) {
  const data = new FormData();
  data.append("task", task);
  data.append("studentName", els.studentName.value);
  data.append("assessmentDate", els.assessmentDate.value);
  data.append("taskNotes", els.taskNotes.value);
  data.append("transcript", els.transcript.value);
  data.append("criteria", JSON.stringify(criteria));
  data.append("gradeScale", JSON.stringify({ pointsMin: 1, pointsMax: 5, gradeMin: 1, gradeMax: 6, rounding: 0.5 }));
  if (els.passageFile.files[0]) data.append("passage", els.passageFile.files[0]);
  if (els.workFile.files[0]) data.append("work", els.workFile.files[0]);
  if (state.audioBlob) data.append("audio", state.audioBlob, `pruefung.${state.audioMimeType.includes("mp4") ? "mp4" : "webm"}`);
  return data;
}

async function callBackend(task) {
  const endpoint = ensureEndpoint();
  if (!endpoint) return null;

  setStatus(task === "transcribe" ? "Transkription läuft …" : "Bewertung läuft …");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: buildPayload(task),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    setStatus(`Backend-Aufruf fehlgeschlagen: ${error.message}`, true);
    return null;
  }
}

async function transcribeAudio() {
  if (!state.audioBlob) {
    setStatus("Bitte zuerst eine Aufnahme erstellen.", true);
    return;
  }
  const result = await callBackend("transcribe");
  if (!result) return;
  if (result.transcript) els.transcript.value = result.transcript;
  setStatus("Transkription übernommen.");
  return result;
}

async function evaluateTranscript() {
  if (!els.transcript.value.trim()) {
    setStatus("Bitte zuerst ein Transkript erfassen oder transkribieren.", true);
    return;
  }
  const result = await callBackend("evaluate");
  if (!result) return;
  state.result = result;
  if (result.transcript) els.transcript.value = result.transcript;
  if (result.overallComment || result.gesamtkommentar) {
    els.overallComment.value = result.overallComment || result.gesamtkommentar;
  }
  renderAssessment(result.assessment || result.bewertung || []);
  setStatus("Bewertung übernommen. Bitte fachlich prüfen, bevor sie verwendet wird.");
  return result;
}

async function startIntegratedExam() {
  const endpoint = ensureEndpoint();
  if (!endpoint) return;

  const recordingStarted = await startRecording({ integrated: true });
  if (!recordingStarted) return;

  const speechStarted = startSpeechRecognitionForExam();
  setStatus(
    speechStarted
      ? "Prüfung läuft: Audio wird aufgenommen, Live-Transkript läuft mit."
      : "Prüfung läuft: Audio wird aufgenommen. Live-Transkript ist in diesem Browser nicht verfügbar."
  );
}

async function finishIntegratedExam() {
  els.finishExamButton.disabled = true;
  stopSpeechRecognitionForExam();
  const stopped = await stopRecording();

  if (!stopped && !state.audioBlob && !els.transcript.value.trim()) {
    setStatus("Keine Aufnahme und kein Transkript vorhanden.", true);
    return;
  }

  if (state.audioBlob) {
    const transcription = await transcribeAudio();
    if (!transcription && !els.transcript.value.trim()) return;
  }

  await evaluateTranscript();
}

function exportData() {
  const assessment = state.result?.assessment || state.result?.bewertung || [];
  const scores = [];
  const rows = criteria
    .map((criterion) => {
      const entry = assessment.find((item) => item.criterion === criterion.title || item.kriterium === criterion.title) || {};
      const score = Number(entry.score ?? entry.punkte);
      if (Number.isFinite(score)) scores.push(score);
      const levelText = Number.isFinite(score)
        ? criterion.levels[Math.max(0, Math.min(4, Math.round(score) - 1))]
        : "nicht bewertet";
      const comment = entry.comment || entry.begruendung || entry.evidence || "Keine Begründung vorhanden.";
      return `<tr>
        <td>${escapeHtml(criterion.title)}</td>
        <td>${Number.isFinite(score) ? escapeHtml(score) : "–"}</td>
        <td>${escapeHtml(levelText)}</td>
        <td>${nl2br(comment)}</td>
      </tr>`;
    })
    .join("");
  const average = scores.length === criteria.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const swissGrade = average === null ? null : pointsToSwissGrade(average);
  const roundedGrade = swissGrade === null ? null : roundToStep(swissGrade, gradeRoundingStep);
  const body = `
    <h1>KI-gestützte Prüfungsbeurteilung</h1>
    <div class="meta">
      <p><strong>Kandidat:in:</strong> ${escapeHtml(els.studentName.value || "–")}</p>
      <p><strong>Datum:</strong> ${escapeHtml(els.assessmentDate.value || "–")}</p>
      <p><strong>Textstelle:</strong> ${escapeHtml(els.passageFile.files[0]?.name || "–")}</p>
      <p><strong>Gesamtes Werk:</strong> ${escapeHtml(els.workFile.files[0]?.name || "–")}</p>
      <p><strong>Exportiert am:</strong> ${escapeHtml(new Date().toLocaleString("de-CH"))}</p>
    </div>
    <h2>Ergebnis</h2>
    <p class="grade">Schweizer Note: ${escapeHtml(formatGrade(roundedGrade))}</p>
    <p class="muted">Punktedurchschnitt: ${escapeHtml(formatGrade(average))}; ungerundete Note: ${escapeHtml(formatGrade(swissGrade))}; Rundung: mathematisch auf halbe Noten.</p>
    <h2>Bewertung nach Kriterien</h2>
    <table>
      <thead>
        <tr><th>Kriterium</th><th>Punkte</th><th>Stufe</th><th>Begründung</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Gesamtkommentar</h2>
    <p>${nl2br(els.overallComment.value || "–")}</p>
    <h2>Notizen zur Aufgabenstellung</h2>
    <p>${nl2br(els.taskNotes.value || "–")}</p>
    <h2>Transkript</h2>
    <p>${nl2br(els.transcript.value || "–")}</p>
  `;
  downloadWordDocument({
    filename: `${safeFileName(els.studentName.value)}-ki-pruefungsbeurteilung.doc`,
    title: "KI-gestützte Prüfungsbeurteilung",
    body,
  });
}

function clearForm() {
  document.querySelector("#assessmentForm").reset();
  state.audioBlob = null;
  state.audioMimeType = "";
  state.result = null;
  els.audioPlayer.removeAttribute("src");
  els.timer.textContent = "00:00";
  els.recordButton.disabled = false;
  els.stopButton.disabled = true;
  els.startExamButton.disabled = false;
  els.finishExamButton.disabled = true;
  updateFileLabels();
  renderEmptyRubric();
  setStatus("Formular geleert.");
}

function initEndpointDefault() {
  if (["http:", "https:"].includes(window.location.protocol) && !els.endpointUrl.value) {
    els.endpointUrl.value = `${window.location.origin}/api/muendliche-pruefung`;
  }
}

els.passageFile.addEventListener("change", updateFileLabels);
els.workFile.addEventListener("change", updateFileLabels);
els.startExamButton.addEventListener("click", startIntegratedExam);
els.finishExamButton.addEventListener("click", finishIntegratedExam);
els.recordButton.addEventListener("click", startRecording);
els.stopButton.addEventListener("click", stopRecording);
els.speechButton.addEventListener("click", toggleSpeechRecognition);
els.transcribeButton.addEventListener("click", transcribeAudio);
els.evaluateButton.addEventListener("click", evaluateTranscript);
els.exportButton.addEventListener("click", exportData);
els.clearButton.addEventListener("click", clearForm);

initSpeechRecognition();
initEndpointDefault();
updateFileLabels();
renderEmptyRubric();
