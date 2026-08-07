"use strict";

const STORAGE_KEY = "pattern-bitacora-attempts-v1";
const MIN_PATTERN_LENGTH = 4;

const canvas = document.getElementById("patternCanvas");
const stage = document.getElementById("canvasStage");
const context = canvas.getContext("2d");
const patternTool = document.querySelector(".pattern-tool");
const statusElement = document.getElementById("patternStatus");
const clearPatternButton = document.getElementById("clearPattern");
const failedCheck = document.getElementById("failedCheck");
const failedLabel = document.getElementById("failedLabel");
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");
const attemptCount = document.getElementById("attemptCount");
const exportHistoryButton = document.getElementById("exportHistory");
const clearHistoryButton = document.getElementById("clearHistory");
const togglePrivacyButton = document.getElementById("togglePrivacy");
const historyPanel = document.querySelector(".history-panel");
const clearDialog = document.getElementById("clearDialog");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

let attempts = loadAttempts();
let sequence = [];
let drawing = false;
let pointerPosition = null;
let canvasSize = 480;
let dots = [];
let toastTimer = null;
let privacyEnabled = false;

function createIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  svg.classList.add("icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function loadAttempts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => {
      if (!item || !Array.isArray(item.sequence)) return false;
      if (item.sequence.length < MIN_PATTERN_LENGTH || item.sequence.length > 9) return false;
      return new Set(item.sequence).size === item.sequence.length
        && item.sequence.every((value) => Number.isInteger(value) && value >= 0 && value <= 8);
    });
  } catch (error) {
    return [];
  }
}

function saveAttempts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    return true;
  } catch (error) {
    showToast("No se pudo guardar en este navegador.");
    return false;
  }
}

function patternKey(pattern) {
  return pattern.join("-");
}

function currentAttempt() {
  const key = patternKey(sequence);
  return attempts.find((attempt) => patternKey(attempt.sequence) === key) || null;
}

function getDots(size) {
  const margin = size * 0.2;
  const spacing = (size - margin * 2) / 2;
  const result = [];

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result.push({
        id: row * 3 + column,
        row,
        column,
        x: margin + column * spacing,
        y: margin + row * spacing,
      });
    }
  }

  return result;
}

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const displaySize = Math.max(280, Math.round(rect.width));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvasSize = displaySize;
  canvas.width = Math.round(displaySize * pixelRatio);
  canvas.height = Math.round(displaySize * pixelRatio);
  canvas.style.width = `${displaySize}px`;
  canvas.style.height = `${displaySize}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  dots = getDots(displaySize);
  drawPattern();
}

function drawDirectionChevron(drawingContext, from, to, color, size, progress = 0.66) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < size * 4) return;

  const x = from.x + dx * progress;
  const y = from.y + dy * progress;
  const angle = Math.atan2(dy, dx);

  drawingContext.save();
  drawingContext.translate(x, y);
  drawingContext.rotate(angle);
  drawingContext.lineCap = "round";
  drawingContext.lineJoin = "round";
  drawingContext.beginPath();
  drawingContext.moveTo(-size, -size * 0.72);
  drawingContext.lineTo(0, 0);
  drawingContext.lineTo(-size, size * 0.72);
  drawingContext.strokeStyle = "#ffffff";
  drawingContext.lineWidth = Math.max(3.5, size * 0.58);
  drawingContext.stroke();
  drawingContext.strokeStyle = color;
  drawingContext.lineWidth = Math.max(1.6, size * 0.24);
  drawingContext.stroke();
  drawingContext.restore();
}

function drawPattern() {
  const attempted = Boolean(currentAttempt());
  const lineColor = attempted ? "#c63f3f" : "#0a7468";
  const softColor = attempted ? "rgba(198, 63, 63, 0.13)" : "rgba(10, 116, 104, 0.13)";

  context.clearRect(0, 0, canvasSize, canvasSize);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvasSize, canvasSize);

  if (sequence.length > 0) {
    context.save();
    context.strokeStyle = lineColor;
    context.lineWidth = Math.max(4, canvasSize * 0.011);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(dots[sequence[0]].x, dots[sequence[0]].y);

    for (let index = 1; index < sequence.length; index += 1) {
      context.lineTo(dots[sequence[index]].x, dots[sequence[index]].y);
    }

    if (drawing && pointerPosition) {
      context.lineTo(pointerPosition.x, pointerPosition.y);
    }

    context.stroke();
    context.restore();

    const arrowSize = Math.max(6.5, canvasSize * 0.015);
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const progress = index % 2 === 0 ? 0.63 : 0.7;
      drawDirectionChevron(context, dots[sequence[index]], dots[sequence[index + 1]], lineColor, arrowSize, progress);
    }

    if (drawing && pointerPosition && sequence.length > 0) {
      drawDirectionChevron(
        context,
        dots[sequence[sequence.length - 1]],
        pointerPosition,
        lineColor,
        arrowSize,
        0.68,
      );
    }
  }

  dots.forEach((dot) => {
    const order = sequence.indexOf(dot.id);
    const active = order >= 0;
    const outerRadius = canvasSize * 0.041;
    const innerRadius = canvasSize * 0.014;

    context.beginPath();
    context.arc(dot.x, dot.y, outerRadius, 0, Math.PI * 2);
    context.fillStyle = active ? softColor : "#f0f3f2";
    context.fill();

    context.beginPath();
    context.arc(dot.x, dot.y, innerRadius, 0, Math.PI * 2);
    context.fillStyle = active ? lineColor : "#6d7874";
    context.fill();
  });
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvasSize / rect.width),
    y: (event.clientY - rect.top) * (canvasSize / rect.height),
  };
}

function hitTest(position) {
  const hitRadius = canvasSize * 0.075;
  return dots.find((dot) => Math.hypot(position.x - dot.x, position.y - dot.y) <= hitRadius) || null;
}

function intermediatePoint(fromId, toId) {
  const from = dots[fromId];
  const to = dots[toId];
  const rowSum = from.row + to.row;
  const columnSum = from.column + to.column;

  if (rowSum % 2 !== 0 || columnSum % 2 !== 0) return null;

  const middleRow = rowSum / 2;
  const middleColumn = columnSum / 2;
  const middleId = middleRow * 3 + middleColumn;

  if (middleId === fromId || middleId === toId || sequence.includes(middleId)) return null;
  return middleId;
}

function addDot(dotId) {
  if (sequence.includes(dotId)) return;

  if (sequence.length > 0) {
    const middleId = intermediatePoint(sequence[sequence.length - 1], dotId);
    if (middleId !== null) sequence.push(middleId);
  }

  sequence.push(dotId);
  updateCurrentPattern();
}

function startDrawing(event) {
  const position = getPointerPosition(event);
  const dot = hitTest(position);
  if (!dot) return;

  event.preventDefault();
  sequence = [];
  drawing = true;
  pointerPosition = position;
  canvas.setPointerCapture(event.pointerId);
  addDot(dot.id);
}

function moveDrawing(event) {
  if (!drawing) return;
  event.preventDefault();
  pointerPosition = getPointerPosition(event);
  const dot = hitTest(pointerPosition);
  if (dot) addDot(dot.id);
  drawPattern();
}

function endDrawing(event) {
  if (!drawing) return;
  event.preventDefault();
  drawing = false;
  pointerPosition = null;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  updateCurrentPattern();
}

function updateCurrentPattern() {
  const attempted = currentAttempt();
  const missingDots = Math.max(0, MIN_PATTERN_LENGTH - sequence.length);
  const hasPattern = sequence.length > 0;
  const isValid = sequence.length >= MIN_PATTERN_LENGTH;

  clearPatternButton.disabled = !hasPattern;

  statusElement.className = "status";
  failedLabel.className = "failed-control";
  patternTool.classList.remove("is-new", "is-tried");

  if (!hasPattern) {
    statusElement.classList.add("status-empty");
    statusElement.textContent = "Dibuja un patron";
    failedCheck.checked = false;
    failedCheck.disabled = true;
    failedLabel.classList.add("is-disabled");
  } else if (!isValid) {
    statusElement.classList.add("status-warning");
    statusElement.textContent = `Faltan ${missingDots} ${missingDots === 1 ? "punto" : "puntos"}`;
    failedCheck.checked = false;
    failedCheck.disabled = true;
    failedLabel.classList.add("is-disabled");
  } else if (attempted) {
    statusElement.classList.add("status-tried");
    statusElement.textContent = "Ya lo intentaste";
    failedCheck.checked = true;
    failedCheck.disabled = true;
    failedLabel.classList.add("is-disabled", "is-recorded");
    patternTool.classList.add("is-tried");
  } else {
    statusElement.classList.add("status-new");
    statusElement.textContent = "Patron nuevo";
    failedCheck.checked = false;
    failedCheck.disabled = false;
    patternTool.classList.add("is-new");
  }

  drawPattern();
  updateHistorySelection();
}

function resetCurrentPattern() {
  sequence = [];
  drawing = false;
  pointerPosition = null;
  updateCurrentPattern();
}

function registerFailedAttempt() {
  if (sequence.length < MIN_PATTERN_LENGTH || currentAttempt()) {
    updateCurrentPattern();
    return;
  }

  const attempt = {
    id: `${Date.now()}-${patternKey(sequence)}`,
    sequence: [...sequence],
    createdAt: new Date().toISOString(),
  };

  attempts.unshift(attempt);
  if (!saveAttempts()) {
    attempts.shift();
    failedCheck.checked = false;
    return;
  }

  renderHistory();
  updateCurrentPattern();
  showToast("Intento guardado.");
}

function removeAttempt(attemptId) {
  attempts = attempts.filter((attempt) => attempt.id !== attemptId);
  saveAttempts();
  renderHistory();
  updateCurrentPattern();
  showToast("Intento quitado.");
}

function loadAttempt(attempt) {
  sequence = [...attempt.sequence];
  drawing = false;
  pointerPosition = null;
  updateCurrentPattern();

  if (window.matchMedia("(max-width: 860px)").matches) {
    patternTool.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function drawMiniPattern(preview, pattern) {
  const miniContext = preview.getContext("2d");
  const size = 116;
  const pixelRatio = 2;
  const miniDots = getDots(size);

  preview.width = size * pixelRatio;
  preview.height = size * pixelRatio;
  miniContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  miniContext.clearRect(0, 0, size, size);

  miniContext.strokeStyle = "#c63f3f";
  miniContext.lineWidth = 4;
  miniContext.lineCap = "round";
  miniContext.lineJoin = "round";
  miniContext.beginPath();
  miniContext.moveTo(miniDots[pattern[0]].x, miniDots[pattern[0]].y);
  pattern.slice(1).forEach((dotId) => {
    miniContext.lineTo(miniDots[dotId].x, miniDots[dotId].y);
  });
  miniContext.stroke();

  pattern.slice(0, -1).forEach((dotId, index) => {
    drawDirectionChevron(
      miniContext,
      miniDots[dotId],
      miniDots[pattern[index + 1]],
      "#c63f3f",
      4.5,
      0.66,
    );
  });

  miniDots.forEach((dot) => {
    miniContext.beginPath();
    miniContext.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
    miniContext.fillStyle = pattern.includes(dot.id) ? "#c63f3f" : "#aeb7b4";
    miniContext.fill();
  });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createHistoryItem(attempt, index) {
  const item = document.createElement("li");
  item.className = "history-item";
  item.dataset.patternKey = patternKey(attempt.sequence);

  const openButton = document.createElement("button");
  openButton.className = "history-open";
  openButton.type = "button";
  openButton.setAttribute("aria-label", `Ver intento ${attempts.length - index}`);
  openButton.addEventListener("click", () => loadAttempt(attempt));

  const previewWrap = document.createElement("span");
  previewWrap.className = "history-preview-wrap";

  const preview = document.createElement("canvas");
  preview.className = "history-preview";
  preview.setAttribute("aria-label", `Vista previa del intento ${attempts.length - index}`);

  const failedBadge = document.createElement("span");
  failedBadge.className = "failed-badge";
  failedBadge.append(createIcon("check"));

  const copy = document.createElement("div");
  copy.className = "history-copy";

  const title = document.createElement("div");
  title.className = "history-title";
  title.textContent = `Intento ${attempts.length - index}`;

  const time = document.createElement("div");
  time.className = "history-time";
  time.textContent = formatDate(attempt.createdAt);

  const removeButton = document.createElement("button");
  removeButton.className = "remove-attempt";
  removeButton.type = "button";
  removeButton.title = "Quitar intento";
  removeButton.setAttribute("aria-label", `Quitar intento ${attempts.length - index}`);
  removeButton.addEventListener("click", () => removeAttempt(attempt.id));
  removeButton.append(createIcon("trash-2"));

  copy.append(title, time);
  previewWrap.append(preview, failedBadge);
  openButton.append(previewWrap, copy);
  item.append(openButton, removeButton);

  requestAnimationFrame(() => drawMiniPattern(preview, attempt.sequence));
  return item;
}

function renderHistory() {
  historyList.replaceChildren();
  attempts.forEach((attempt, index) => {
    historyList.append(createHistoryItem(attempt, index));
  });

  const hasAttempts = attempts.length > 0;
  emptyHistory.hidden = hasAttempts;
  historyList.hidden = !hasAttempts;
  attemptCount.textContent = String(attempts.length);
  exportHistoryButton.disabled = !hasAttempts;
  clearHistoryButton.disabled = !hasAttempts;
  updateHistorySelection();
}

function updateHistorySelection() {
  const key = sequence.length >= MIN_PATTERN_LENGTH ? patternKey(sequence) : "";
  historyList.querySelectorAll(".history-item").forEach((item) => {
    item.classList.toggle("is-selected", Boolean(key) && item.dataset.patternKey === key);
  });
}

function exportHistory() {
  if (attempts.length === 0) return;

  const exportData = {
    exportedAt: new Date().toISOString(),
    attempts: attempts.map((attempt) => ({
      sequence: attempt.sequence.map((value) => value + 1),
      createdAt: attempt.createdAt,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bitacora-patrones-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Bitacora exportada.");
}

function clearAllAttempts() {
  if (attempts.length === 0) return;

  if (typeof clearDialog.showModal === "function") {
    clearDialog.returnValue = "";
    clearDialog.showModal();
    return;
  }

  if (window.confirm("Se borraran todos los intentos guardados en este navegador.")) {
    performClearAll();
  }
}

function performClearAll() {
  attempts = [];
  saveAttempts();
  renderHistory();
  updateCurrentPattern();
  showToast("Bitacora borrada.");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toastText.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
}

function togglePrivacy() {
  privacyEnabled = !privacyEnabled;
  historyPanel.classList.toggle("is-private", privacyEnabled);
  togglePrivacyButton.setAttribute("aria-pressed", String(privacyEnabled));

  const label = privacyEnabled ? "Mostrar trazos" : "Ocultar trazos";
  togglePrivacyButton.title = label;
  togglePrivacyButton.querySelector(".sr-only").textContent = label;
  togglePrivacyButton.querySelector("use").setAttribute("href", privacyEnabled ? "#icon-eye-off" : "#icon-eye");
}

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", moveDrawing);
canvas.addEventListener("pointerup", endDrawing);
canvas.addEventListener("pointercancel", endDrawing);
clearPatternButton.addEventListener("click", resetCurrentPattern);
failedCheck.addEventListener("change", () => {
  if (failedCheck.checked) registerFailedAttempt();
});
exportHistoryButton.addEventListener("click", exportHistory);
clearHistoryButton.addEventListener("click", clearAllAttempts);
togglePrivacyButton.addEventListener("click", togglePrivacy);
clearDialog.addEventListener("close", () => {
  if (clearDialog.returnValue === "confirm") performClearAll();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !clearDialog.open && sequence.length > 0) resetCurrentPattern();
});

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(stage);

renderHistory();
updateCurrentPattern();
