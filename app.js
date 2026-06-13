const criteria = [
  {
    title: "Eigene Interpretation / Erklärungsansätze",
    help: "Entwickelt eigenständige Deutungen und macht nachvollziehbar, wie diese aus Text, Material oder Thema entstehen.",
  },
  {
    title: "Kann im Gespräch eigene Interpretationsansätze entwickeln",
    help: "Greift Impulse auf, denkt sichtbar weiter und kann den eigenen Ansatz im Dialog präzisieren oder erweitern.",
  },
  {
    title: "Antworten auf Fragen",
    help: "Reagiert sachbezogen, vollständig und flexibel auf Nachfragen; Unsicherheiten werden reflektiert statt ausgewichen.",
  },
  {
    title: "Argumentationsfähigkeit",
    help: "Begründet Aussagen schlüssig, setzt Belege sinnvoll ein und verbindet Einzelbeobachtungen zu einer tragfähigen Linie.",
  },
  {
    title: "Sprache",
    help: "Spricht verständlich, präzise und fachsprachlich angemessen; Ausdruck und Struktur unterstützen die Gedankenführung.",
  },
];

const levels = [
  { label: "1", value: 1, help: "nicht erfüllt" },
  { label: "2", value: 2, help: "ansatzweise erfüllt" },
  { label: "3", value: 3, help: "grundsätzlich erfüllt" },
  { label: "4", value: 4, help: "gut erfüllt" },
  { label: "5", value: 5, help: "sehr gut erfüllt" },
];

const gradeRoundingStep = 0.5;
const storageKey = "muendliche-pruefungsbeurteilung-v1";
const state = {
  scores: Array(criteria.length).fill(null),
  studentName: "",
  assessmentDate: "",
  comment: "",
};

const rowsContainer = document.querySelector("#criteriaRows");
const finalGrade = document.querySelector("#finalGrade");
const progressText = document.querySelector("#progressText");
const averageText = document.querySelector("#averageText");
const studentName = document.querySelector("#studentName");
const assessmentDate = document.querySelector("#assessmentDate");
const comment = document.querySelector("#comment");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
const printButton = document.querySelector("#printButton");

function formatGrade(value) {
  if (value == null || Number.isNaN(value)) return "–";
  return Number(value.toFixed(2)).toLocaleString("de-CH", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function pointsToSwissGrade(pointsAverage) {
  return 1 + ((pointsAverage - 1) * 5) / 4;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return;
    state.scores = Array.isArray(saved.scores) ? saved.scores.slice(0, criteria.length) : state.scores;
    while (state.scores.length < criteria.length) state.scores.push(null);
    state.studentName = saved.studentName || "";
    state.assessmentDate = saved.assessmentDate || "";
    state.comment = saved.comment || "";
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function renderRows() {
  rowsContainer.innerHTML = "";

  criteria.forEach((criterion, criterionIndex) => {
    const row = document.createElement("div");
    row.className = "criterion-row";

    const title = document.createElement("div");
    title.className = "criterion-title";
    const titleText = document.createElement("strong");
    titleText.textContent = criterion.title;
    const help = document.createElement("span");
    help.textContent = criterion.help;
    title.append(titleText, help);
    row.append(title);

    levels.forEach((level, levelIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "score-button";
      button.dataset.criterion = String(criterionIndex);
      button.dataset.level = String(levelIndex);
      button.dataset.label = level.label;
      button.title = `${criterion.title}: ${level.label} (${level.help})`;
      button.setAttribute("aria-label", `${criterion.title}: ${level.label} (${level.help})`);
      button.setAttribute("aria-pressed", state.scores[criterionIndex] === levelIndex ? "true" : "false");
      if (state.scores[criterionIndex] === levelIndex) button.classList.add("is-selected");
      row.append(button);
    });

    rowsContainer.append(row);
  });
}

function updateResult() {
  const selectedScores = state.scores
    .filter((levelIndex) => levelIndex !== null)
    .map((levelIndex) => levels[levelIndex].value);

  const completed = selectedScores.length;
  progressText.textContent = `${completed} von ${criteria.length} Kriterien bewertet`;

  if (completed === 0) {
    finalGrade.textContent = "–";
    averageText.textContent = "Punktedurchschnitt: –";
    document.title = "Beurteilung mündlicher Prüfungen";
    return;
  }

  const average = selectedScores.reduce((sum, score) => sum + score, 0) / completed;
  const swissGrade = pointsToSwissGrade(average);
  const roundedGrade = roundToStep(swissGrade, gradeRoundingStep);
  finalGrade.textContent = formatGrade(roundedGrade);
  averageText.textContent = `Punktedurchschnitt: ${formatGrade(average)} · ungerundet: ${formatGrade(swissGrade)}`;
  document.title = `Note ${formatGrade(roundedGrade)} · Beurteilung mündlicher Prüfungen`;
}

function syncForm() {
  studentName.value = state.studentName;
  assessmentDate.value = state.assessmentDate;
  comment.value = state.comment;
  renderRows();
  updateResult();
}

function setScore(criterionIndex, levelIndex) {
  state.scores[criterionIndex] = state.scores[criterionIndex] === levelIndex ? null : levelIndex;
  saveState();
  renderRows();
  updateResult();
}

rowsContainer.addEventListener("click", (event) => {
  const button = event.target.closest(".score-button");
  if (!button) return;
  setScore(Number(button.dataset.criterion), Number(button.dataset.level));
});

studentName.addEventListener("input", () => {
  state.studentName = studentName.value;
  saveState();
});

assessmentDate.addEventListener("input", () => {
  state.assessmentDate = assessmentDate.value;
  saveState();
});

comment.addEventListener("input", () => {
  state.comment = comment.value;
  saveState();
});

clearButton.addEventListener("click", () => {
  state.scores = Array(criteria.length).fill(null);
  state.studentName = "";
  state.assessmentDate = "";
  state.comment = "";
  saveState();
  syncForm();
});

exportButton.addEventListener("click", () => {
  const selectedScores = state.scores.map((levelIndex, criterionIndex) => ({
    kriterium: criteria[criterionIndex].title,
    orientierung: criteria[criterionIndex].help,
    punkte: levelIndex === null ? null : levels[levelIndex].value,
    stufe: levelIndex === null ? null : levels[levelIndex].help,
  }));
  const completed = selectedScores.filter((entry) => entry.punkte !== null);
  const average =
    completed.length === 0
      ? null
      : completed.reduce((sum, entry) => sum + entry.punkte, 0) / completed.length;
  const swissGrade = average === null ? null : pointsToSwissGrade(average);
  const roundedGrade = swissGrade === null ? null : roundToStep(swissGrade, gradeRoundingStep);
  const payload = {
    name: state.studentName,
    datum: state.assessmentDate,
    kommentar: state.comment,
    rundung: "mathematisch auf halbe Noten",
    rundungsschritt: gradeRoundingStep,
    punktedurchschnitt: average,
    noteUngerundet: swissGrade,
    note: roundedGrade,
    kriterien: selectedScores,
    exportiertAm: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const safeName = (state.studentName || "muendliche-pruefung").trim().replace(/[^a-z0-9_-]+/gi, "-");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}-beurteilung.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

printButton.addEventListener("click", () => {
  window.print();
});

loadState();
syncForm();
