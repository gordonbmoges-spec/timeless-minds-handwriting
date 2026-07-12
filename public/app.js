import { PERSONAS, findPersona } from "/data/personas.js";
import { PERSONA_ASSETS, getPersonaAssets } from "/assets/personas/manifest.js";
import { requestPersonaReply } from "/modules/ai-client.js";
import { InkEngine } from "/modules/ink-engine.js";
import { ReplyPresenter } from "/modules/reply-presenter.js";
import { navigateTo, personaPath, routeFromPath } from "/modules/router.js";

const API_SETTINGS_KEY = "ink-diary-api-settings-v1";
const IDLE_SEND_MS = 1_800;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

const elements = Object.fromEntries([
  "archiveView", "sceneView", "personaList", "archiveApiSettings", "sceneBackdrop",
  "mobileBack", "mobileSettings", "mobilePersonaName", "mobilePersonaField",
  "backToArchive", "personaIndex", "personaPortrait", "personaLatin", "personaName",
  "personaYears", "personaField", "personaMedium", "sceneLocation", "sceneTitle",
  "statusReadout", "paperObject", "paperImage", "writingSurface", "inkCanvas",
  "replyCanvas", "loadingNote", "penTool", "eraserTool", "sendNow", "clearPage",
  "keywordList", "metricWidth", "metricInput", "modeCopy", "openApiSettings",
  "apiSettingsDialog", "apiSettingsForm", "closeApiSettings", "clearApiSettings",
  "toggleApiKey", "apiProvider", "apiKey", "apiBaseUrl", "apiModel", "modelHint",
  "apiFormMessage"
].map((id) => [id, document.getElementById(id)]));

const state = {
  persona: null,
  assets: null,
  ink: null,
  reply: null,
  resizeObserver: null,
  idleTimer: null,
  busy: false,
  history: []
};

renderArchive();
bindGlobalEvents();
handleRoute();
updateConnectionCopy();
registerLocalAppShell();

function renderArchive() {
  elements.personaList.replaceChildren(...PERSONAS.map((persona, index) => {
    const assets = getPersonaAssets(persona.id);
    const available = Boolean(assets);
    const button = document.createElement("button");
    button.className = "persona-record";
    button.type = "button";
    button.dataset.personaId = persona.id;
    button.setAttribute("aria-disabled", String(!available));

    const number = document.createElement("span");
    number.className = "persona-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const portrait = available
      ? document.createElement("img")
      : document.createElement("span");
    portrait.className = available ? "record-portrait" : "record-portrait placeholder";
    if (available) {
      portrait.src = assets.portrait;
      portrait.alt = `${persona.name}历史肖像`;
    } else {
      portrait.textContent = persona.name.slice(0, 1);
      portrait.setAttribute("aria-hidden", "true");
    }

    const name = document.createElement("span");
    name.className = "record-name";
    const strong = document.createElement("strong");
    strong.textContent = persona.name;
    const latin = document.createElement("span");
    latin.textContent = persona.latinName;
    name.append(strong, latin);

    const meta = document.createElement("span");
    meta.className = "record-meta";
    meta.textContent = `${persona.field}\n${persona.years}`;

    const medium = document.createElement("span");
    medium.className = "record-medium";
    medium.textContent = persona.medium;

    const status = document.createElement("span");
    status.className = `record-status${available ? "" : " pending"}`;
    status.textContent = available ? "进入档案 →" : "整理中";

    button.append(number, portrait, name, meta, medium, status);
    button.addEventListener("click", () => {
      if (available) navigateTo(personaPath(persona.id));
      else {
        status.textContent = "将在孔子验收后开放";
        setTimeout(() => { status.textContent = "整理中"; }, 1_800);
      }
    });
    return button;
  }));
}

function bindGlobalEvents() {
  addEventListener("popstate", handleRoute);
  elements.backToArchive.addEventListener("click", () => navigateTo("/"));
  elements.mobileBack.addEventListener("click", () => navigateTo("/"));
  elements.penTool.addEventListener("click", () => setTool("pen"));
  elements.eraserTool.addEventListener("click", () => setTool("eraser"));
  elements.sendNow.addEventListener("click", commitPage);
  elements.clearPage.addEventListener("click", clearPage);

  for (const button of [elements.archiveApiSettings, elements.openApiSettings, elements.mobileSettings]) {
    button.addEventListener("click", showApiSettings);
  }
  elements.closeApiSettings.addEventListener("click", () => elements.apiSettingsDialog.close());
  elements.clearApiSettings.addEventListener("click", clearSavedApiSettings);
  elements.toggleApiKey.addEventListener("click", toggleKeyVisibility);
  elements.apiProvider.addEventListener("change", applyProviderDefaults);
  elements.apiSettingsForm.addEventListener("submit", saveApiSettings);
  elements.apiSettingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.apiSettingsDialog) elements.apiSettingsDialog.close();
  });
}

function handleRoute() {
  const route = routeFromPath(location.pathname);
  if (route.view === "persona") {
    const persona = findPersona(route.personaId);
    const assets = getPersonaAssets(route.personaId);
    if (persona && assets) {
      showScene(persona, assets);
      return;
    }
  }
  showArchive();
}

function showArchive() {
  teardownScene();
  state.persona = null;
  state.assets = null;
  elements.sceneView.hidden = true;
  elements.archiveView.hidden = false;
  document.title = "思想档案馆";
}

function showScene(persona, assets) {
  teardownScene();
  state.persona = persona;
  state.assets = assets;
  state.history = [];
  elements.archiveView.hidden = true;
  elements.sceneView.hidden = false;
  document.title = `${persona.name} · 思想档案馆`;

  elements.sceneBackdrop.style.backgroundImage = `url("${assets.background}")`;
  elements.sceneBackdrop.style.backgroundPosition = assets.backgroundFocus;
  elements.personaPortrait.src = assets.portrait;
  elements.personaPortrait.alt = `${persona.name}历史肖像`;
  elements.personaLatin.textContent = persona.latinName;
  elements.personaName.textContent = persona.name;
  elements.personaYears.textContent = persona.years;
  elements.personaField.textContent = persona.field;
  elements.personaMedium.textContent = persona.medium;
  elements.personaIndex.textContent = `ARCHIVE ${String(PERSONAS.indexOf(persona) + 1).padStart(2, "0")}`;
  elements.mobilePersonaName.textContent = persona.name;
  elements.mobilePersonaField.textContent = `${persona.field} · ${persona.years}`;
  elements.sceneLocation.textContent = persona.id === "confucius" ? "LU · PRIVATE STUDY" : persona.latinName;
  elements.sceneTitle.textContent = persona.id === "confucius" ? "竹简问答" : persona.medium;
  elements.paperImage.hidden = false;
  elements.paperObject.style.background = "";
  elements.paperObject.style.border = "";
  elements.paperImage.src = assets.paper;
  elements.paperImage.alt = `${persona.name}的空白${persona.medium.split(" · ")[0]}`;
  elements.paperObject.style.aspectRatio = String(assets.paperAspectRatio || 1);
  elements.writingSurface.style.setProperty("--write-x", `${assets.writingArea.x * 100}%`);
  elements.writingSurface.style.setProperty("--write-y", `${assets.writingArea.y * 100}%`);
  elements.writingSurface.style.setProperty("--write-width", `${assets.writingArea.width * 100}%`);
  elements.writingSurface.style.setProperty("--write-height", `${assets.writingArea.height * 100}%`);
  elements.keywordList.replaceChildren(...persona.keywords.map((keyword, index) => {
    const li = document.createElement("li");
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    li.append(number, document.createTextNode(keyword));
    return li;
  }));

  elements.paperImage.addEventListener("error", showPaperFallback, { once: true });
  requestAnimationFrame(setupSceneEngines);
  setStatus("等待书写");
  setTool("pen");
}

function setupSceneEngines() {
  if (!state.persona || elements.sceneView.hidden) return;
  state.reply = new ReplyPresenter(elements.replyCanvas, {
    reducedMotion,
    onCleared: () => {
      if (!state.busy && state.ink?.activePointerId === null) setStatus("等待书写");
    }
  });
  state.ink = new InkEngine(elements.inkCanvas, {
    inkColor: state.assets.ink,
    canStart: () => !state.busy,
    onStrokeStart: ({ pointerType }) => {
      clearTimeout(state.idleTimer);
      state.reply.fade(1_800);
      elements.metricInput.textContent = pointerType === "pen" ? "Pencil" : pointerType === "touch" ? "触控" : "鼠标";
      setStatus("正在书写");
    },
    onStrokeEnd: ({ style }) => {
      elements.metricWidth.textContent = style.inkWidth.toFixed(1);
      scheduleCommit();
    }
  });

  const resize = () => {
    const rect = elements.writingSurface.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    state.ink.resize(rect.width, rect.height);
    state.reply.resize(rect.width, rect.height);
  };
  state.resizeObserver = new ResizeObserver(resize);
  state.resizeObserver.observe(elements.writingSurface);
  resize();
}

function teardownScene() {
  clearTimeout(state.idleTimer);
  state.resizeObserver?.disconnect();
  state.ink?.destroy();
  state.reply?.clear();
  state.resizeObserver = null;
  state.ink = null;
  state.reply = null;
  state.busy = false;
  elements.loadingNote.hidden = true;
}

function showPaperFallback() {
  elements.paperImage.hidden = true;
  elements.paperObject.style.background = "#b18b4e";
  elements.paperObject.style.border = "10px solid #6f512c";
}

function setTool(tool) {
  state.ink?.setTool(tool);
  elements.penTool.classList.toggle("active", tool === "pen");
  elements.eraserTool.classList.toggle("active", tool === "eraser");
  elements.inkCanvas.style.cursor = tool === "pen" ? "crosshair" : "cell";
}

function scheduleCommit() {
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(commitPage, IDLE_SEND_MS);
  setStatus("停笔后发送");
}

async function commitPage() {
  if (state.busy || !state.ink?.hasInk() || !state.persona) return;
  clearTimeout(state.idleTimer);
  const imageDataUrl = state.ink.exportPng();
  if (!imageDataUrl) return;
  state.busy = true;
  state.ink.setEnabled(false);
  elements.loadingNote.hidden = false;
  setStatus("正在识别", "busy");

  try {
    const data = await requestPersonaReply({
      imageDataUrl,
      personaId: state.persona.id,
      style: state.ink.sampleStyle(),
      history: state.history.slice(-6),
      apiConfig: readApiSettings()
    });
    await fadeAndClearInk();
    state.history.push({ transcript: data.transcript || "", reply: data.reply || "" });
    elements.modeCopy.textContent = data.mode === "demo"
      ? `演示模式 · ${state.persona.name}人物内核已启用，尚未识别真实手写。`
      : `AI 模式 · ${state.persona.name}已读取纸面并回应。`;
    setStatus(data.status === "needs_clarification" ? "请再写一次" : "正在回信", "busy");
    await state.reply.show(data.reply || "", {
      direction: state.assets.writingDirection,
      color: state.assets.replyInk,
      fontFamily: '"STKaiti", "KaiTi", "Songti SC", serif',
      fontSize: state.persona.id === "confucius" ? 34 : 38,
      pace: data.style?.pace || 1
    });
    setStatus("等待书写");
  } catch (error) {
    console.error("Reply request failed", { code: error.code, status: error.status });
    setStatus("接口错误 · 可重试", "error");
    elements.modeCopy.textContent = error.message || "请求失败，当前笔迹已保留。";
  } finally {
    elements.loadingNote.hidden = true;
    state.busy = false;
    state.ink?.setEnabled(true);
  }
}

async function fadeAndClearInk() {
  elements.inkCanvas.style.opacity = "0";
  await wait(reducedMotion ? 1 : 850);
  state.ink.clear();
  elements.inkCanvas.style.transition = "none";
  elements.inkCanvas.style.opacity = "1";
  void elements.inkCanvas.offsetWidth;
  elements.inkCanvas.style.transition = "opacity 850ms linear";
}

function clearPage() {
  clearTimeout(state.idleTimer);
  state.ink?.clear();
  state.reply?.clear();
  state.busy = false;
  elements.loadingNote.hidden = true;
  setStatus("等待书写");
}

function setStatus(text, mode = "") {
  const copy = elements.statusReadout.querySelector("strong");
  copy.textContent = text;
  elements.statusReadout.classList.toggle("busy", mode === "busy");
  elements.statusReadout.classList.toggle("error", mode === "error");
}

function showApiSettings() {
  const saved = readApiSettings();
  const provider = saved?.provider || "aliyun";
  elements.apiProvider.value = provider;
  elements.apiKey.value = saved?.apiKey || "";
  elements.apiBaseUrl.value = saved?.baseUrl || providerDefaults[provider].baseUrl;
  elements.apiModel.value = saved?.model || providerDefaults[provider].model;
  elements.modelHint.textContent = providerDefaults[provider].hint;
  elements.apiFormMessage.textContent = saved ? "已读取当前浏览器中的配置。" : "";
  elements.apiFormMessage.className = "form-message";
  elements.apiKey.type = "password";
  elements.toggleApiKey.textContent = "显示";
  elements.apiSettingsDialog.showModal();
  elements.apiKey.focus();
}

function applyProviderDefaults() {
  const defaults = providerDefaults[elements.apiProvider.value];
  elements.apiBaseUrl.value = defaults.baseUrl;
  elements.apiModel.value = defaults.model;
  elements.modelHint.textContent = defaults.hint;
  elements.apiFormMessage.textContent = "";
}

function saveApiSettings(event) {
  event.preventDefault();
  const config = {
    provider: elements.apiProvider.value,
    apiKey: elements.apiKey.value.trim(),
    baseUrl: elements.apiBaseUrl.value.trim().replace(/\/+$/, ""),
    model: elements.apiModel.value.trim()
  };
  if (!config.apiKey || !config.baseUrl || !config.model) {
    showApiFormMessage("请把 API Key、接口地址和视觉模型填写完整。", "error");
    return;
  }
  try {
    const url = new URL(config.baseUrl);
    if (url.protocol !== "https:") throw new Error("insecure");
  } catch {
    showApiFormMessage("接口地址格式不正确，必须使用 HTTPS。", "error");
    return;
  }
  try {
    localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(config));
  } catch {
    showApiFormMessage("浏览器不允许持久保存，本次会话无法启用本地配置。", "error");
    return;
  }
  updateConnectionCopy();
  showApiFormMessage("配置已保存，下一次书写会使用这个模型。", "success");
  setTimeout(() => elements.apiSettingsDialog.close(), reducedMotion ? 0 : 500);
}

function clearSavedApiSettings() {
  try { localStorage.removeItem(API_SETTINGS_KEY); } catch {}
  elements.apiKey.value = "";
  elements.apiProvider.value = "aliyun";
  applyProviderDefaults();
  updateConnectionCopy();
  showApiFormMessage("浏览器配置已清除，将使用服务器配置或演示模式。", "success");
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
  elements.modeCopy.textContent = config
    ? `已配置 ${providerName(config.provider)} · ${config.model}。Key 仅保存在当前浏览器。`
    : "尚未在浏览器配置 API。服务器有 Key 时自动使用，否则进入演示模式。";
}

function providerName(provider) {
  return { aliyun: "阿里云百炼", doubao: "火山方舟", custom: "自定义接口" }[provider] || "自定义接口";
}

function toggleKeyVisibility() {
  const showing = elements.apiKey.type === "text";
  elements.apiKey.type = showing ? "password" : "text";
  elements.toggleApiKey.textContent = showing ? "显示" : "隐藏";
  elements.toggleApiKey.setAttribute("aria-label", showing ? "显示 API Key" : "隐藏 API Key");
}

function showApiFormMessage(message, type) {
  elements.apiFormMessage.textContent = message;
  elements.apiFormMessage.className = `form-message ${type}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registerLocalAppShell() {
  if (!("serviceWorker" in navigator) || !isSecureContext) return;
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}), { once: true });
}
