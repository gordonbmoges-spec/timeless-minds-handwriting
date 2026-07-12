const canvas = document.querySelector("#paperCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const statusPill = document.querySelector("#statusPill");
const thinkingPanel = document.querySelector("#thinkingPanel");
const turnList = document.querySelector("#turnList");
const modeCopy = document.querySelector("#modeCopy");

const penTool = document.querySelector("#penTool");
const eraserTool = document.querySelector("#eraserTool");
const sendNow = document.querySelector("#sendNow");
const clearPage = document.querySelector("#clearPage");
const apiSettingsDialog = document.querySelector("#apiSettingsDialog");
const apiSettingsForm = document.querySelector("#apiSettingsForm");
const openApiSettings = document.querySelector("#openApiSettings");
const closeApiSettings = document.querySelector("#closeApiSettings");
const clearApiSettings = document.querySelector("#clearApiSettings");
const toggleApiKey = document.querySelector("#toggleApiKey");
const apiProvider = document.querySelector("#apiProvider");
const apiKey = document.querySelector("#apiKey");
const apiBaseUrl = document.querySelector("#apiBaseUrl");
const apiModel = document.querySelector("#apiModel");
const modelHint = document.querySelector("#modelHint");
const apiFormMessage = document.querySelector("#apiFormMessage");

const metricWidth = document.querySelector("#metricWidth");
const metricSlant = document.querySelector("#metricSlant");
const metricSize = document.querySelector("#metricSize");
const metricPace = document.querySelector("#metricPace");

const API_SETTINGS_KEY = "ink-diary-api-settings-v1";
const REPLY_HOLD_MS = 10_000;
const REPLY_FADE_MS = 1_800;
const NEW_INK_FADE_MS = 1_800;
const providerDefaults = {
  aliyun: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3-vl-plus",
    hint: "推荐使用 qwen3-vl-plus，需支持图片输入。"
  },
  doubao: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "",
    hint: "请填写火山方舟控制台中的推理接入点 ID。"
  },
  custom: {
    baseUrl: "",
    model: "",
    hint: "接口需兼容 OpenAI Chat Completions，并支持图片输入。"
  }
};

const state = {
  dpr: Math.max(1, Math.min(window.devicePixelRatio || 1, 2)),
  width: 0,
  height: 0,
  tool: "pen",
  drawing: false,
  currentStroke: null,
  strokes: [],
  replies: [],
  turns: [],
  idleTimer: null,
  busy: false,
  style: {
    inkWidth: 3,
    slant: 0,
    letterSize: 42,
    pace: 1
  }
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

resizeCanvas();
render();

new ResizeObserver(() => {
  resizeCanvas();
  render();
}).observe(canvas.parentElement);

canvas.addEventListener("pointerdown", startStroke);
canvas.addEventListener("pointermove", continueStroke);
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
canvas.addEventListener("pointerleave", endStroke);

penTool.addEventListener("click", () => setTool("pen"));
eraserTool.addEventListener("click", () => setTool("eraser"));
sendNow.addEventListener("click", () => commitPage());
clearPage.addEventListener("click", clearAll);
openApiSettings.addEventListener("click", showApiSettings);
closeApiSettings.addEventListener("click", () => apiSettingsDialog.close());
clearApiSettings.addEventListener("click", clearSavedApiSettings);
toggleApiKey.addEventListener("click", toggleKeyVisibility);
apiProvider.addEventListener("change", applyProviderDefaults);
apiSettingsForm.addEventListener("submit", saveApiSettings);
apiSettingsDialog.addEventListener("click", closeDialogFromBackdrop);

updateConnectionCopy();
registerLocalAppShell();

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  state.width = Math.max(320, Math.floor(rect.width));
  state.height = Math.max(360, Math.floor(rect.height));
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function setTool(tool) {
  state.tool = tool;
  penTool.classList.toggle("active", tool === "pen");
  eraserTool.classList.toggle("active", tool === "eraser");
  canvas.style.cursor = tool === "pen" ? "crosshair" : "cell";
}

function startStroke(event) {
  if (state.busy) return;
  if (state.tool === "pen") fadeCurrentReply();
  canvas.setPointerCapture(event.pointerId);
  clearTimeout(state.idleTimer);
  const point = eventPoint(event);
  state.drawing = true;
  state.currentStroke = {
    mode: state.tool,
    points: [point],
    alpha: 1,
    startedAt: performance.now()
  };
}

function continueStroke(event) {
  if (!state.drawing || !state.currentStroke) return;
  const point = eventPoint(event);
  const points = state.currentStroke.points;
  const previous = points[points.length - 1];
  if (distance(previous, point) < 1.5) return;
  points.push(point);
  render();
}

function endStroke() {
  if (!state.drawing || !state.currentStroke) return;
  state.drawing = false;
  if (state.currentStroke.points.length > 1) {
    state.strokes.push(state.currentStroke);
    state.style = sampleStyle(state.strokes);
    updateMetrics();
    scheduleCommit();
  }
  state.currentStroke = null;
  render();
}

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const pressure = event.pressure && event.pressure > 0 ? event.pressure : 0.55;
  const width = state.tool === "eraser" ? 22 : 1.8 + pressure * 4.2;
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    t: performance.now(),
    w: width
  };
}

function scheduleCommit() {
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => commitPage(), 1800);
  setStatus("停笔后发送");
}

async function commitPage() {
  if (state.busy || !hasInk()) return;
  clearTimeout(state.idleTimer);
  state.busy = true;
  setStatus("墨迹淡出");

  const imageDataUrl = exportInkImage();
  fadeUserInk();
  thinkingPanel.hidden = false;

  try {
    const response = await fetch("/api/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        personaId: "confucius",
        style: state.style,
        history: state.turns.slice(-6),
        apiConfig: readApiSettings()
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "AI request failed");

    modeCopy.textContent = data.mode === "demo"
      ? "当前是演示模式：打开 API 设置，接入视觉模型后即可识别真实手写。"
      : "当前是 AI 模式：已识别纸面内容并生成回信。";

    const turn = {
      transcript: data.transcript || "",
      reply: data.reply || "",
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    state.turns.push(turn);
    const turnElement = appendTurn(turn);
    await writeReply(data.reply || "", data.style || state.style, turnElement);
    setStatus("等待书写");
  } catch (error) {
    console.error(error);
    await writeReply("这页纸暂时没有连上回信的声音。检查后端配置后再写一次。", state.style);
    setStatus("接口错误");
  } finally {
    thinkingPanel.hidden = true;
    state.busy = false;
  }
}

function hasInk() {
  return state.strokes.some((stroke) => stroke.mode === "pen" && stroke.points.length > 1);
}

function fadeUserInk() {
  const start = performance.now();
  const duration = reducedMotion ? 1 : 850;
  const inkStrokes = state.strokes.filter((stroke) => stroke.mode === "pen");

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const alpha = 1 - easeOut(progress);
    for (const stroke of inkStrokes) stroke.alpha = alpha;
    render();
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      state.strokes = [];
      render();
    }
  }

  requestAnimationFrame(tick);
}

async function writeReply(text, style, turnElement = null) {
  if (!text.trim()) return;
  setStatus("正在回信");
  clearCanvasReplies();

  const block = makeReplyBlock(text, style, turnElement);
  state.replies = [block];

  const totalChars = block.lines.join("").length;
  const start = performance.now();
  const speed = reducedMotion ? totalChars * 100 : 32 / style.pace;

  return new Promise((resolve) => {
    function tick(now) {
      const elapsed = (now - start) / 1000;
      block.reveal = Math.min(totalChars, Math.floor(elapsed * speed));
      render();
      if (block.reveal < totalChars) {
        requestAnimationFrame(tick);
      } else {
        block.reveal = totalChars;
        render();
        scheduleReplyFade(block);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

function makeReplyBlock(text, style, turnElement = null) {
  const size = clamp(style.letterSize, 30, 58);
  ctx.save();
  ctx.font = `${size}px "Dancing Script", cursive`;
  const maxWidth = Math.min(820, state.width - 88);
  const lines = wrapText(text, maxWidth);
  ctx.restore();

  return {
    lines,
    reveal: 0,
    x: Math.max(34, Math.min(72, state.width * 0.08)),
    y: Math.max(126, state.height * 0.34),
    size,
    slant: clamp(style.slant, -0.28, 0.28),
    width: clamp(style.inkWidth, 2, 7),
    seed: Math.random() * 1000,
    alpha: 1,
    fadeTimer: null,
    fading: false,
    turnElement
  };
}

function scheduleReplyFade(block) {
  block.fadeTimer = setTimeout(() => fadeReply(block), REPLY_HOLD_MS);
}

function fadeReply(block, requestedDuration = REPLY_FADE_MS) {
  if (!state.replies.includes(block) || block.fading) return;
  block.fading = true;
  clearTimeout(block.fadeTimer);
  const start = performance.now();
  const duration = reducedMotion ? 1 : requestedDuration;
  fadeTurnEntry(block.turnElement, duration);

  function tick(now) {
    if (!state.replies.includes(block)) return;
    const progress = Math.min(1, (now - start) / duration);
    block.alpha = 1 - progress;
    render();

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    state.replies = state.replies.filter((reply) => reply !== block);
    render();
  }

  requestAnimationFrame(tick);
}

function clearCanvasReplies() {
  for (const reply of state.replies) clearTimeout(reply.fadeTimer);
  state.replies = [];
  render();
}

function fadeCurrentReply() {
  for (const reply of state.replies) fadeReply(reply, NEW_INK_FADE_MS);
}

function wrapText(text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        const broken = breakLongWord(word, maxWidth);
        lines.push(...broken.slice(0, -1));
        line = broken.at(-1) || "";
      }
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [String(text)];
}

function breakLongWord(word, maxWidth) {
  const out = [];
  let chunk = "";
  for (const char of Array.from(word)) {
    const candidate = `${chunk}${char}`;
    if (ctx.measureText(candidate).width <= maxWidth || !chunk) {
      chunk = candidate;
    } else {
      out.push(chunk);
      chunk = char;
    }
  }
  if (chunk) out.push(chunk);
  return out;
}

function render() {
  ctx.clearRect(0, 0, state.width, state.height);
  drawPaperTint();

  for (const stroke of state.strokes) drawStroke(stroke);
  if (state.currentStroke) drawStroke(state.currentStroke);
  for (const reply of state.replies.slice(-3)) drawReply(reply);
}

function drawPaperTint() {
  ctx.save();
  ctx.fillStyle = "rgba(255, 253, 247, 0.12)";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function drawStroke(stroke) {
  const points = stroke.points;
  if (points.length < 2) return;

  ctx.save();
  ctx.globalAlpha = stroke.alpha ?? 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.mode === "eraser" ? "#fffdf7" : "rgba(24, 31, 28, 0.92)";

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    ctx.lineWidth = stroke.mode === "eraser" ? b.w : Math.max(1.8, (a.w + b.w) / 2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawReply(block) {
  ctx.save();
  ctx.globalAlpha = block.alpha ?? 1;
  ctx.translate(block.x, block.y);
  ctx.transform(1, 0, block.slant, 1, 0, 0);
  ctx.font = `${block.size}px "Dancing Script", "Segoe Print", cursive`;
  ctx.fillStyle = "rgba(39, 47, 42, 0.9)";
  ctx.strokeStyle = "rgba(39, 47, 42, 0.24)";
  ctx.lineWidth = Math.max(0.8, block.width * 0.26);
  ctx.textBaseline = "alphabetic";

  let remaining = block.reveal;
  const lineHeight = block.size * 1.08;
  for (let i = 0; i < block.lines.length; i += 1) {
    const line = block.lines[i];
    const take = Math.max(0, Math.min(line.length, remaining));
    const visible = line.slice(0, take);
    const y = i * lineHeight + jitter(block.seed + i, 2.4);
    ctx.save();
    ctx.rotate(jitter(block.seed + i * 7, 0.006));
    ctx.strokeText(visible, 0, y);
    ctx.fillText(visible, 0, y);
    ctx.restore();
    remaining -= take;
    if (remaining <= 0) break;
  }
  ctx.restore();
}

function exportInkImage() {
  const bbox = inkBounds();
  const pad = 28;
  const x = Math.max(0, bbox.x - pad);
  const y = Math.max(0, bbox.y - pad);
  const w = Math.min(state.width - x, bbox.w + pad * 2);
  const h = Math.min(state.height - y, bbox.h + pad * 2);
  const longSide = Math.max(w, h);
  const scale = longSide > 920 ? 920 / longSide : 1;

  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.floor(w * scale));
  off.height = Math.max(1, Math.floor(h * scale));
  const offCtx = off.getContext("2d");
  offCtx.fillStyle = "#fffdf7";
  offCtx.fillRect(0, 0, off.width, off.height);
  offCtx.scale(scale, scale);
  offCtx.translate(-x, -y);

  for (const stroke of state.strokes) drawStrokeOn(offCtx, stroke);

  return off.toDataURL("image/png");
}

function drawStrokeOn(target, stroke) {
  const points = stroke.points;
  target.save();
  target.lineCap = "round";
  target.lineJoin = "round";
  target.strokeStyle = stroke.mode === "eraser" ? "#fffdf7" : "rgba(24, 31, 28, 0.94)";
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    target.lineWidth = stroke.mode === "eraser" ? b.w : Math.max(1.8, (a.w + b.w) / 2);
    target.beginPath();
    target.moveTo(a.x, a.y);
    target.lineTo(b.x, b.y);
    target.stroke();
  }
  target.restore();
}

function inkBounds() {
  const points = state.strokes
    .filter((stroke) => stroke.mode === "pen")
    .flatMap((stroke) => stroke.points);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function sampleStyle(strokes) {
  const penStrokes = strokes.filter((stroke) => stroke.mode === "pen" && stroke.points.length > 2);
  const points = penStrokes.flatMap((stroke) => stroke.points);
  if (!points.length) return state.style;

  const avgWidth = average(points.map((point) => point.w));
  const bbox = inkBounds();
  const letterSize = clamp(bbox.h * 0.42, 32, 58);
  const pace = clamp(average(penStrokes.map(strokePace)), 0.7, 1.45);
  const slant = clamp(estimateSlant(penStrokes), -0.28, 0.28);

  return {
    inkWidth: Number(avgWidth.toFixed(2)),
    slant: Number(slant.toFixed(3)),
    letterSize: Number(letterSize.toFixed(1)),
    pace: Number(pace.toFixed(2))
  };
}

function strokePace(stroke) {
  const points = stroke.points;
  const length = points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
  const time = Math.max(120, points[points.length - 1].t - points[0].t);
  return clamp(length / time / 0.42, 0.65, 1.6);
}

function estimateSlant(strokes) {
  const values = [];
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.points.length; i += 1) {
      const a = stroke.points[i - 1];
      const b = stroke.points[i];
      const dy = b.y - a.y;
      const dx = b.x - a.x;
      if (Math.abs(dy) > 3 && Math.abs(dx) < 30) values.push(dx / Math.abs(dy));
    }
  }
  return values.length ? average(values) * 0.16 : 0;
}

function updateMetrics() {
  metricWidth.textContent = state.style.inkWidth.toFixed(1);
  metricSlant.textContent = state.style.slant.toFixed(2);
  metricSize.textContent = Math.round(state.style.letterSize);
  metricPace.textContent = state.style.pace.toFixed(1);
}

function appendTurn(turn) {
  turnList.innerHTML = "";
  const li = document.createElement("li");
  const title = document.createElement("strong");
  const copy = document.createElement("p");
  title.textContent = `${turn.at} 回信`;
  copy.textContent = turn.reply;
  li.prepend(title);
  li.append(copy);
  turnList.prepend(li);
  while (turnList.children.length > 5) turnList.lastElementChild.remove();
  return li;
}

function fadeTurnEntry(element, duration) {
  if (!element?.isConnected || element.dataset.fading === "true") return;
  element.dataset.fading = "true";
  element.style.transitionDuration = `${duration}ms`;
  element.classList.add("fading");
  setTimeout(() => {
    element.remove();
    if (!turnList.querySelector("li")) showTurnEmptyState();
  }, duration);
}

function showTurnEmptyState() {
  turnList.innerHTML = '<li class="empty-note">写一句话，停笔后纸页会自动回应。</li>';
}

function clearAll() {
  clearTimeout(state.idleTimer);
  clearCanvasReplies();
  state.strokes = [];
  state.currentStroke = null;
  showTurnEmptyState();
  state.busy = false;
  thinkingPanel.hidden = true;
  setStatus("等待书写");
  render();
}

function setStatus(text) {
  statusPill.textContent = text;
}

function showApiSettings() {
  const saved = readApiSettings();
  const provider = saved?.provider || "aliyun";
  apiProvider.value = provider;
  apiKey.value = saved?.apiKey || "";
  apiBaseUrl.value = saved?.baseUrl || providerDefaults[provider].baseUrl;
  apiModel.value = saved?.model || providerDefaults[provider].model;
  modelHint.textContent = providerDefaults[provider].hint;
  apiFormMessage.textContent = saved ? "已读取当前浏览器中的配置。" : "";
  apiFormMessage.className = "form-message";
  apiKey.type = "password";
  toggleApiKey.textContent = "显示";
  apiSettingsDialog.showModal();
  apiKey.focus();
}

function applyProviderDefaults() {
  const defaults = providerDefaults[apiProvider.value];
  apiBaseUrl.value = defaults.baseUrl;
  apiModel.value = defaults.model;
  modelHint.textContent = defaults.hint;
  apiFormMessage.textContent = "";
}

function saveApiSettings(event) {
  event.preventDefault();
  const config = {
    provider: apiProvider.value,
    apiKey: apiKey.value.trim(),
    baseUrl: apiBaseUrl.value.trim().replace(/\/+$/, ""),
    model: apiModel.value.trim()
  };

  if (!config.apiKey || !config.baseUrl || !config.model) {
    apiFormMessage.textContent = "请把 API Key、接口地址和视觉模型填写完整。";
    apiFormMessage.className = "form-message error";
    return;
  }

  try {
    const url = new URL(config.baseUrl);
    if (url.protocol !== "https:") throw new Error("insecure");
  } catch {
    apiFormMessage.textContent = "接口地址格式不正确，必须使用 HTTPS。";
    apiFormMessage.className = "form-message error";
    return;
  }

  localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(config));
  updateConnectionCopy();
  apiFormMessage.textContent = "配置已保存，下一次书写会使用这个模型。";
  apiFormMessage.className = "form-message success";
  setTimeout(() => apiSettingsDialog.close(), reducedMotion ? 0 : 650);
}

function clearSavedApiSettings() {
  localStorage.removeItem(API_SETTINGS_KEY);
  apiKey.value = "";
  apiProvider.value = "aliyun";
  applyProviderDefaults();
  apiFormMessage.textContent = "浏览器配置已清除，将使用服务器配置或演示模式。";
  apiFormMessage.className = "form-message success";
  updateConnectionCopy();
}

function readApiSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(API_SETTINGS_KEY));
    if (!value?.apiKey || !value?.baseUrl || !value?.model) return null;
    return value;
  } catch {
    return null;
  }
}

function updateConnectionCopy() {
  const config = readApiSettings();
  if (!config) {
    modeCopy.textContent = "尚未在浏览器中配置 API。服务器有 Key 时自动使用，否则进入演示模式。";
    openApiSettings.classList.remove("configured");
    openApiSettings.textContent = "API 设置";
    return;
  }
  const providerName = apiProviderName(config.provider);
  modeCopy.textContent = `已配置 ${providerName} · ${config.model}。Key 仅保存在当前浏览器。`;
  openApiSettings.classList.add("configured");
  openApiSettings.textContent = "API 已配置";
}

function apiProviderName(provider) {
  return {
    aliyun: "阿里云百炼",
    doubao: "火山方舟",
    custom: "自定义接口"
  }[provider] || "自定义接口";
}

function toggleKeyVisibility() {
  const showing = apiKey.type === "text";
  apiKey.type = showing ? "password" : "text";
  toggleApiKey.textContent = showing ? "显示" : "隐藏";
  toggleApiKey.setAttribute("aria-label", showing ? "显示 API Key" : "隐藏 API Key");
}

function closeDialogFromBackdrop(event) {
  if (event.target === apiSettingsDialog) apiSettingsDialog.close();
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function registerLocalAppShell() {
  if (!("serviceWorker" in navigator)) return;
  const { protocol, hostname } = window.location;
  const isSecureLocalhost = protocol === "https:"
    || hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "[::1]";
  if (!isSecureLocalhost) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function jitter(seed, scale) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * scale;
}
