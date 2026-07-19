import { PERSONAS, findPersona } from "/data/personas.js";
import { PERSONA_ASSETS, getPersonaAssets } from "/assets/personas/manifest.js";
import { requestPersonaReply } from "/modules/ai-client.js";
import { shouldCloseFromPinch, shouldOpenDrawerFromEdge } from "/modules/book-gestures.js";
import { createHistoryStore } from "/modules/history-store.js";
import { createCustomBookStore } from "/modules/custom-books.js";
import { InkEngine } from "/modules/ink-engine.js";
import { ReplyPresenter } from "/modules/reply-presenter.js";
import { navigateTo, personaPath, routeFromPath } from "/modules/router.js";

const API_SETTINGS_KEY = "ink-diary-api-settings-v1";
const REPLY_PREFERENCE_PREFIX = "minds-archive-reply-preference-v1-";
const PERSONA_MEMORY_PREFIX = "minds-archive-memory-v1-";
const IDLE_SEND_MS = 1_800;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const historyStore = createHistoryStore();
const customBookStore = createCustomBookStore();
let customBooks = customBookStore.load();
let apiSessionConfig = null;
let purgedLegacyApiSettings = false;

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
  "archiveView", "sceneView", "personaList", "archiveApiSettings", "createBook", "sceneBackdrop",
  "mobileBack", "mobileSettings", "mobileHistory", "mobileReplySettings", "mobilePersonaName", "mobilePersonaField",
  "backToArchive", "personaIndex", "personaPortrait", "personaSigil", "personaLatin", "personaName",
  "personaYears", "personaField", "personaMedium", "sceneLocation", "sceneTitle",
  "statusReadout", "paperObject", "paperImage", "writingSurface", "inkCanvas",
  "replyCanvas", "loadingNote", "penTool", "eraserTool", "sendNow", "clearPage",
  "keywordList", "metricWidth", "metricInput", "modeCopy", "openApiSettings", "openHistory", "openReplySettings",
  "apiSettingsDialog", "apiSettingsForm", "closeApiSettings", "clearApiSettings",
  "toggleApiKey", "apiProvider", "apiKey", "apiBaseUrl", "apiModel", "modelHint",
  "apiFormMessage", "replySettingsDialog", "replySettingsForm", "closeReplySettings",
  "clearReplySettings", "personaInstruction", "personaMemory", "replyFormMessage", "historyDialog",
  "closeHistory", "clearHistory", "historyList", "historyTitle", "createBookDialog",
  "createBookForm", "closeCreateBook", "customBookTitle", "customPersonaName", "customIdentity",
  "customPersonality", "customOpeningLine", "customBookTone", "customSigil", "createBookMessage",
  "bookDrawer", "toggleBookDrawer", "closeBookDrawer", "activeBookVolume", "activeBookTitle",
  "activeBookOwner", "pinchHint", "openingSequence", "openingFlipbook", "openingBookSigil", "openingBookTitle",
  "openingBookLatin"
].map((id) => [id, document.getElementById(id)]));

const state = {
  persona: null,
  assets: null,
  ink: null,
  reply: null,
  resizeObserver: null,
  idleTimer: null,
  busy: false,
  history: [],
  touchPoints: new Map(),
  pinchStart: null,
  edgePullStart: null,
  closing: false,
  openingTimer: null,
  pageFlip: null,
  flipTimers: []
};

renderArchive();
bindGlobalEvents();
handleRoute();
updateConnectionCopy();
registerLocalAppShell();

function renderArchive() {
  const books = allPersonas();
  elements.personaList.replaceChildren(...books.map((persona, index) => {
    const assets = getAvailableAssets(persona);
    const available = Boolean(assets);
    const button = document.createElement("button");
    button.className = `book-card book-${persona.bookTone || "archive"}`;
    button.type = "button";
    button.dataset.personaId = persona.id;
    button.setAttribute("aria-disabled", String(!available));
    button.setAttribute("aria-label", `打开《${persona.bookTitle || persona.name}》，与${persona.name}对话`);

    const volume = document.createElement("span");
    volume.className = "book-volume";

    const number = document.createElement("span");
    number.className = "book-number";
    number.textContent = `VOL. ${String(index + 1).padStart(2, "0")}`;

    let emblem;
    if (assets?.portrait) {
      emblem = document.createElement("img");
      emblem.className = "book-cameo";
      emblem.src = assets.portrait;
      emblem.alt = "";
    } else {
      emblem = document.createElement("span");
      emblem.className = "book-sigil";
      emblem.textContent = persona.sigil || persona.name.slice(0, 1);
      emblem.setAttribute("aria-hidden", "true");
    }

    const title = document.createElement("strong");
    title.className = "book-title";
    title.textContent = persona.bookTitle || persona.name;

    const latin = document.createElement("span");
    latin.className = "book-latin";
    latin.textContent = persona.latinName;

    const owner = document.createElement("span");
    owner.className = "book-owner";
    owner.textContent = persona.name;

    const status = document.createElement("span");
    status.className = "book-open-copy";
    status.textContent = available ? "轻触翻开" : "整理中";

    volume.append(number, emblem, title, latin, owner, status);
    button.append(volume);
    button.addEventListener("click", () => {
      if (!available) return;
      openBook(persona.id, button);
    });
    return button;
  }));
}

function openBook(personaId, button) {
  if (button.classList.contains("is-opening")) return;
  button.classList.add("is-opening");
  elements.archiveView.classList.add("is-opening-book");
  const delay = reducedMotion ? 0 : 1_050;
  setTimeout(() => {
    elements.archiveView.classList.remove("is-opening-book");
    button.classList.remove("is-opening");
    navigateTo(personaPath(personaId));
  }, delay);
}

function bindGlobalEvents() {
  addEventListener("popstate", handleRoute);
  elements.backToArchive.addEventListener("click", closeBookToShelf);
  elements.mobileBack.addEventListener("click", closeBookToShelf);
  elements.toggleBookDrawer.addEventListener("click", toggleBookDrawer);
  elements.closeBookDrawer.addEventListener("click", () => setBookDrawer(false));
  elements.sceneView.addEventListener("pointerdown", trackBookGesture, true);
  elements.sceneView.addEventListener("pointermove", trackBookGesture, true);
  elements.sceneView.addEventListener("pointerup", endBookGesture, true);
  elements.sceneView.addEventListener("pointercancel", endBookGesture, true);
  addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || elements.sceneView.hidden) return;
    if (elements.sceneView.classList.contains("drawer-open")) setBookDrawer(false);
    else closeBookToShelf();
  });
  elements.penTool.addEventListener("click", () => setTool("pen"));
  elements.eraserTool.addEventListener("click", () => setTool("eraser"));
  elements.sendNow.addEventListener("click", commitPage);
  elements.clearPage.addEventListener("click", clearPage);
  elements.createBook.addEventListener("click", showCreateBook);
  elements.closeCreateBook.addEventListener("click", () => elements.createBookDialog.close());
  elements.createBookForm.addEventListener("submit", saveCustomBook);
  elements.createBookDialog.addEventListener("click", (event) => {
    if (event.target === elements.createBookDialog) elements.createBookDialog.close();
  });

  for (const button of [elements.archiveApiSettings, elements.openApiSettings, elements.mobileSettings]) {
    button.addEventListener("click", showApiSettings);
  }
  for (const button of [elements.openHistory, elements.mobileHistory]) {
    button.addEventListener("click", showHistory);
  }
  for (const button of [elements.openReplySettings, elements.mobileReplySettings]) {
    button.addEventListener("click", showReplySettings);
  }
  elements.closeApiSettings.addEventListener("click", () => elements.apiSettingsDialog.close());
  elements.clearApiSettings.addEventListener("click", clearSavedApiSettings);
  elements.toggleApiKey.addEventListener("click", toggleKeyVisibility);
  elements.apiProvider.addEventListener("change", applyProviderDefaults);
  elements.apiSettingsForm.addEventListener("submit", saveApiSettings);
  elements.apiSettingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.apiSettingsDialog) elements.apiSettingsDialog.close();
  });
  elements.closeReplySettings.addEventListener("click", () => elements.replySettingsDialog.close());
  elements.clearReplySettings.addEventListener("click", clearSavedReplyPreference);
  elements.replySettingsForm.addEventListener("submit", saveReplyPreference);
  elements.replySettingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.replySettingsDialog) elements.replySettingsDialog.close();
  });
  elements.closeHistory.addEventListener("click", () => elements.historyDialog.close());
  elements.clearHistory.addEventListener("click", clearPersonaHistory);
  elements.historyDialog.addEventListener("click", (event) => {
    if (event.target === elements.historyDialog) elements.historyDialog.close();
  });
}

function handleRoute() {
  const route = routeFromPath(location.pathname);
  if (route.view === "persona") {
    const persona = findAvailablePersona(route.personaId);
    const assets = persona ? getAvailableAssets(persona) : null;
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
  elements.sceneView.classList.remove("is-revealed", "is-book-opening", "is-closing-book", "is-pinching", "drawer-open");
  elements.bookDrawer.setAttribute("aria-hidden", "true");
  elements.bookDrawer.inert = true;
  elements.toggleBookDrawer.setAttribute("aria-expanded", "false");
  state.closing = false;
  document.title = "会回应的藏书阁";
}

function showScene(persona, assets) {
  teardownScene();
  state.persona = persona;
  state.assets = assets;
  state.history = historyStore.load(persona.id);
  elements.archiveView.hidden = true;
  elements.sceneView.hidden = false;
  elements.sceneView.classList.remove("is-book-opening", "is-closing-book", "is-pinching", "drawer-open");
  elements.bookDrawer.inert = true;
  state.closing = false;
  document.title = `${persona.bookTitle || persona.name} · 会回应的藏书阁`;

  elements.sceneBackdrop.style.backgroundImage = assets.background ? `url("${assets.background}")` : assets.backgroundCss;
  elements.sceneBackdrop.style.backgroundPosition = assets.backgroundFocus;
  elements.personaPortrait.hidden = !assets.portrait;
  elements.personaSigil.hidden = Boolean(assets.portrait);
  if (assets.portrait) {
    elements.personaPortrait.src = assets.portrait;
    elements.personaPortrait.alt = `${persona.name}人物图像`;
  } else {
    elements.personaPortrait.removeAttribute("src");
    elements.personaPortrait.alt = "";
    elements.personaSigil.textContent = assets.sigil || persona.sigil || persona.name.slice(0, 1);
  }
  elements.personaLatin.textContent = persona.latinName;
  elements.personaName.textContent = persona.name;
  elements.personaYears.textContent = persona.years;
  elements.personaField.textContent = persona.field;
  elements.personaMedium.textContent = persona.medium;
  elements.personaIndex.textContent = `VOLUME ${String(allPersonas().findIndex((book) => book.id === persona.id) + 1).padStart(2, "0")}`;
  elements.mobilePersonaName.textContent = persona.name;
  elements.mobilePersonaField.textContent = `${persona.field} · ${persona.years}`;
  elements.sceneLocation.textContent = assets.sceneLocation || persona.latinName;
  elements.sceneTitle.textContent = assets.sceneTitle || persona.medium;
  const volumeNumber = allPersonas().findIndex((book) => book.id === persona.id) + 1;
  elements.activeBookVolume.textContent = `VOL. ${String(volumeNumber).padStart(2, "0")}`;
  elements.activeBookTitle.textContent = persona.bookTitle || persona.name;
  elements.activeBookOwner.textContent = persona.name;
  elements.openingBookSigil.textContent = assets.sigil || persona.sigil || persona.name.slice(0, 1);
  elements.openingBookTitle.textContent = persona.bookTitle || persona.name;
  elements.openingBookLatin.textContent = persona.latinName;
  elements.paperObject.classList.remove("book-unfolding");
  elements.paperObject.dataset.bookTitle = persona.bookTitle || persona.name;
  const coverColor = assets.coverColor || bookCoverColor(persona.bookTone);
  const coverAccent = assets.coverAccent || "#b9ad61";
  for (const target of [elements.sceneView, elements.paperObject]) {
    target.style.setProperty("--book-cover", coverColor);
    target.style.setProperty("--book-accent", coverAccent);
  }
  elements.paperImage.hidden = true;
  elements.paperImage.removeAttribute("src");
  elements.paperImage.alt = "";
  elements.paperObject.style.background = "";
  elements.paperObject.style.border = "";
  elements.paperObject.style.aspectRatio = "auto";
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
  updateHistoryCount();

  if (assets.paper) elements.paperImage.addEventListener("error", showPaperFallback, { once: true });
  requestAnimationFrame(() => {
    elements.sceneView.classList.add("is-revealed", "is-book-opening");
    setupOpeningFlipbook();
    state.openingTimer = setTimeout(() => {
      elements.sceneView.classList.remove("is-book-opening");
      state.openingTimer = null;
      showOpeningLine();
    }, reducedMotion ? 0 : 3_350);
  });
  requestAnimationFrame(setupSceneEngines);
  setStatus("等待书写");
  setTool("pen");
}

function toggleBookDrawer() {
  setBookDrawer(!elements.sceneView.classList.contains("drawer-open"));
}

function setBookDrawer(open) {
  if (elements.sceneView.hidden || state.closing) return;
  elements.sceneView.classList.toggle("drawer-open", Boolean(open));
  elements.bookDrawer.setAttribute("aria-hidden", String(!open));
  elements.bookDrawer.inert = !open;
  elements.toggleBookDrawer.setAttribute("aria-expanded", String(Boolean(open)));
  if (open) elements.closeBookDrawer.focus({ preventScroll: true });
}

function trackBookGesture(event) {
  if (event.pointerType !== "touch" || elements.sceneView.hidden || state.closing) return;
  const point = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (event.type === "pointerdown") {
    state.touchPoints.set(event.pointerId, point);
    if (state.touchPoints.size === 1 && point.x <= 34) state.edgePullStart = point;
    if (state.touchPoints.size === 2) {
      state.pinchStart = [...state.touchPoints.values()].map(({ id, x, y }) => ({ id, x, y }));
      state.edgePullStart = null;
      elements.sceneView.classList.add("is-pinching");
      clearTimeout(state.idleTimer);
      state.ink?.cancelActiveStroke?.();
      state.ink?.setEnabled(false);
    }
    return;
  }

  if (!state.touchPoints.has(event.pointerId)) return;
  state.touchPoints.set(event.pointerId, point);
  if (state.pinchStart?.length === 2 && state.touchPoints.size >= 2) {
    const current = state.pinchStart.map((start) => state.touchPoints.get(start.id)).filter(Boolean);
    if (shouldCloseFromPinch(state.pinchStart, current)) closeBookToShelf();
    return;
  }
  if (state.edgePullStart && !elements.sceneView.classList.contains("drawer-open") && shouldOpenDrawerFromEdge(state.edgePullStart, point)) {
    state.edgePullStart = null;
    setBookDrawer(true);
  }
}

function endBookGesture(event) {
  if (event.pointerType !== "touch") return;
  state.touchPoints.delete(event.pointerId);
  if (state.touchPoints.size < 2) {
    state.pinchStart = null;
    elements.sceneView.classList.remove("is-pinching");
    if (!state.busy && !state.closing) state.ink?.setEnabled(true);
  }
  if (!state.touchPoints.size) state.edgePullStart = null;
}

function closeBookToShelf() {
  if (elements.sceneView.hidden || state.closing) return;
  clearTimeout(state.idleTimer);
  clearFlipTimers();
  state.ink?.setEnabled(false);
  setBookDrawer(false);
  state.closing = true;
  elements.sceneView.classList.add("is-closing-book");
  elements.sceneView.classList.remove("is-book-opening");
  elements.sceneView.classList.remove("is-pinching");
  if (!reducedMotion && state.pageFlip) {
    state.flipTimers.push(setTimeout(() => state.pageFlip?.flipPrev("bottom"), 180));
    state.flipTimers.push(setTimeout(() => state.pageFlip?.flipPrev("top"), 1_140));
  }
  setTimeout(() => navigateTo("/"), reducedMotion ? 0 : 2_350);
}

function setupOpeningFlipbook() {
  clearFlipTimers();
  if (reducedMotion || !globalThis.St?.PageFlip || !elements.openingFlipbook) return;
  disposePageFlip();

  const pages = elements.openingFlipbook.querySelectorAll(":scope > .opening-flip-page");
  if (pages.length < 4) return;

  const pageFlip = new globalThis.St.PageFlip(elements.openingFlipbook, {
    width: 430,
    height: 620,
    size: "stretch",
    minWidth: 250,
    maxWidth: 520,
    minHeight: 360,
    maxHeight: 750,
    drawShadow: true,
    flippingTime: 920,
    usePortrait: true,
    startZIndex: 1,
    autoSize: true,
    maxShadowOpacity: 0.72,
    showCover: true,
    mobileScrollSupport: false,
    useMouseEvents: true,
    disableFlipByClick: true
  });
  state.pageFlip = pageFlip;
  pageFlip.on("init", () => {
    if (state.pageFlip !== pageFlip || state.closing) return;
    state.flipTimers.push(setTimeout(() => pageFlip.flipNext("top"), 360));
    state.flipTimers.push(setTimeout(() => pageFlip.flipNext("bottom"), 1_420));
  });
  pageFlip.loadFromHTML(pages);
}

function clearFlipTimers() {
  for (const timer of state.flipTimers) clearTimeout(timer);
  state.flipTimers = [];
}

function disposePageFlip() {
  if (!state.pageFlip) return;
  try {
    state.pageFlip.clear();
    state.pageFlip.destroy();
  } catch (error) {
    console.warn("Page flip cleanup failed", error);
  }
  state.pageFlip = null;
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

function showOpeningLine(attempt = 0) {
  if (!state.persona?.openingLine || state.busy || state.ink?.hasInk()) return;
  if (!state.reply) {
    if (attempt < 3) setTimeout(() => showOpeningLine(attempt + 1), 50);
    return;
  }
  state.reply.show(state.persona.openingLine, {
    direction: state.assets.writingDirection,
    align: "center",
    topRatio: 0.08,
    maxWidthRatio: 0.82,
    color: state.assets.replyInk,
    fontFamily: replyFontFor(state.persona.openingLine),
    fontSize: state.assets.replyFontSize || 36,
    pace: 1.18
  });
}

function teardownScene() {
  clearTimeout(state.idleTimer);
  clearTimeout(state.openingTimer);
  clearFlipTimers();
  disposePageFlip();
  state.resizeObserver?.disconnect();
  state.ink?.destroy();
  state.reply?.clear();
  state.resizeObserver = null;
  state.ink = null;
  state.reply = null;
  state.busy = false;
  state.touchPoints.clear();
  state.pinchStart = null;
  state.edgePullStart = null;
  state.openingTimer = null;
  elements.loadingNote.hidden = true;
}

function showPaperFallback() {
  elements.paperImage.hidden = true;
  elements.paperObject.style.background = state.assets?.paperBackground || "#b18b4e";
  elements.paperObject.style.border = state.assets?.paperBorder || "10px solid #6f512c";
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
      history: state.history.slice(0, 6).reverse(),
      personaInstruction: readReplyPreference(state.persona.id),
      personaMemory: readPersonaMemory(state.persona.id),
      customPersona: state.persona.isCustom ? {
        name: state.persona.name,
        bookTitle: state.persona.bookTitle,
        identity: state.persona.identity,
        personality: state.persona.personality,
        openingLine: state.persona.openingLine
      } : null,
      apiConfig: readApiSettings()
    });
    await fadeAndClearInk();
    if (data.mode === "ai" && data.status === "ok" && data.transcript && data.reply) {
      state.history = historyStore.append(state.persona.id, {
        transcript: data.transcript,
        reply: data.reply,
        at: new Date().toISOString()
      });
      updateHistoryCount();
    }
    elements.modeCopy.textContent = data.mode === "demo"
      ? `演示模式 · ${state.persona.name}人物内核已启用；演示句不会存入历史档案。`
      : `AI 模式 · ${state.persona.name}已读取纸面并回应。`;
    setStatus(data.status === "needs_clarification" ? "请再写一次" : "正在回信", "busy");
    await state.reply.show(data.reply || "", {
      direction: state.assets.writingDirection,
      align: "center",
      topRatio: 0.08,
      maxWidthRatio: 0.82,
      color: state.assets.replyInk,
      fontFamily: replyFontFor(data.reply),
      fontSize: state.assets.replyFontSize || 36,
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
  elements.apiFormMessage.textContent = saved ? "已读取当前页面中的配置。" : "";
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
  apiSessionConfig = config;
  updateConnectionCopy();
  showApiFormMessage("配置已启用，刷新或关闭页面后会自动清除。", "success");
  setTimeout(() => elements.apiSettingsDialog.close(), reducedMotion ? 0 : 500);
}

function clearSavedApiSettings() {
  try { localStorage.removeItem(API_SETTINGS_KEY); } catch {}
  apiSessionConfig = null;
  elements.apiKey.value = "";
  elements.apiProvider.value = "aliyun";
  applyProviderDefaults();
  updateConnectionCopy();
  showApiFormMessage("页面配置已清除，将使用服务器配置或演示模式。", "success");
}

function readApiSettings() {
  if (!purgedLegacyApiSettings) {
    try { localStorage.removeItem(API_SETTINGS_KEY); } catch {}
    purgedLegacyApiSettings = true;
  }
  return apiSessionConfig;
}

function updateConnectionCopy() {
  const config = readApiSettings();
  elements.modeCopy.textContent = config
    ? `已配置 ${providerName(config.provider)} · ${config.model}。Key 仅保存在页面内存。`
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

function showReplySettings() {
  if (!state.persona) return;
  elements.personaInstruction.value = readReplyPreference(state.persona.id);
  elements.personaMemory.value = readPersonaMemory(state.persona.id);
  elements.replySettingsTitle.textContent = `${state.persona.name} · 回复方式`;
  elements.replyFormMessage.textContent = "";
  elements.replyFormMessage.className = "form-message";
  elements.replySettingsDialog.showModal();
  elements.personaInstruction.focus();
}

function saveReplyPreference(event) {
  event.preventDefault();
  if (!state.persona) return;
  const value = elements.personaInstruction.value.replace(/\s+/g, " ").trim().slice(0, 300);
  const memory = elements.personaMemory.value.replace(/\s+/g, " ").trim().slice(0, 600);
  try {
    if (value) localStorage.setItem(`${REPLY_PREFERENCE_PREFIX}${state.persona.id}`, value);
    else localStorage.removeItem(`${REPLY_PREFERENCE_PREFIX}${state.persona.id}`);
    if (memory) localStorage.setItem(`${PERSONA_MEMORY_PREFIX}${state.persona.id}`, memory);
    else localStorage.removeItem(`${PERSONA_MEMORY_PREFIX}${state.persona.id}`);
  } catch {
    showReplyFormMessage("浏览器不允许保存这项设置。", "error");
    return;
  }
  elements.personaInstruction.value = value;
  elements.personaMemory.value = memory;
  showReplyFormMessage(value || memory ? "回复偏好与长期记忆已保存。" : "已恢复人物默认回复方式并清空长期记忆。", "success");
  setTimeout(() => elements.replySettingsDialog.close(), reducedMotion ? 0 : 500);
}

function clearSavedReplyPreference() {
  if (!state.persona) return;
  try { localStorage.removeItem(`${REPLY_PREFERENCE_PREFIX}${state.persona.id}`); } catch {}
  elements.personaInstruction.value = "";
  showReplyFormMessage("已恢复人物默认回复方式；长期记忆仍然保留。", "success");
}

function readReplyPreference(personaId) {
  try { return String(localStorage.getItem(`${REPLY_PREFERENCE_PREFIX}${personaId}`) || "").slice(0, 300); }
  catch { return ""; }
}

function readPersonaMemory(personaId) {
  try { return String(localStorage.getItem(`${PERSONA_MEMORY_PREFIX}${personaId}`) || "").slice(0, 600); }
  catch { return ""; }
}

function showReplyFormMessage(message, type) {
  elements.replyFormMessage.textContent = message;
  elements.replyFormMessage.className = `form-message ${type}`;
}

function showHistory() {
  if (!state.persona) return;
  state.history = historyStore.load(state.persona.id);
  elements.historyTitle.textContent = `${state.persona.name} · 历史档案`;
  renderHistory();
  elements.historyDialog.showModal();
}

function renderHistory() {
  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "还没有真实 AI 对话。写下一个问题后，回信会保存在这里。";
    elements.historyList.replaceChildren(empty);
    return;
  }
  elements.historyList.replaceChildren(...state.history.map((turn) => {
    const article = document.createElement("article");
    article.className = "history-turn";
    const time = document.createElement("time");
    time.className = "history-time";
    time.dateTime = turn.at;
    time.textContent = formatArchiveTime(turn.at);
    const copy = document.createElement("div");
    copy.className = "history-copy";
    const question = document.createElement("p");
    question.className = "history-question";
    question.textContent = `你写：${turn.transcript}`;
    const reply = document.createElement("p");
    reply.className = "history-reply";
    reply.textContent = `${state.persona.name}：${turn.reply}`;
    copy.append(question, reply);
    article.append(time, copy);
    return article;
  }));
}

function clearPersonaHistory() {
  if (!state.persona || !state.history.length) return;
  historyStore.clear(state.persona.id);
  state.history = [];
  updateHistoryCount();
  renderHistory();
}

function updateHistoryCount() {
  elements.openHistory.textContent = `历史档案 · ${state.history.length}`;
  elements.mobileHistory.setAttribute("aria-label", `查看历史档案，共 ${state.history.length} 条`);
}

function formatArchiveTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未记载";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(date);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function replyFontFor(text) {
  const value = String(text || "");
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  const cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
  return latin > cjk
    ? '"IM FELL English", "Dancing Script", Georgia, serif'
    : '"ZCOOL XiaoWei", "Kaiti SC", "STKaiti", "KaiTi", serif';
}

function bookCoverColor(tone) {
  return {
    jade: "#203c32", marble: "#5c5c54", umber: "#5a351f", wine: "#51212a",
    crimson: "#5d171c", midnight: "#17283a", silver: "#273237", obsidian: "#17130f",
    parchment: "#4a2e1c"
  }[tone] || "#2c2a22";
}

function allPersonas() {
  return [...PERSONAS, ...customBooks];
}

function findAvailablePersona(id) {
  return findPersona(id) || customBooks.find((book) => book.id === id) || null;
}

function getAvailableAssets(persona) {
  return getPersonaAssets(persona.id) || (persona.isCustom ? customAssets(persona) : null);
}

function customAssets(persona) {
  const cover = bookCoverColor(persona.bookTone);
  return {
    background: null,
    backgroundCss: `radial-gradient(circle at 50% 30%, ${cover}88, transparent 34%), linear-gradient(145deg, #10110f, #030403 70%)`,
    paper: null,
    portrait: null,
    sigil: persona.sigil,
    sceneLocation: "A PRIVATE SHELF · YOUR MEMORY",
    sceneTitle: persona.bookTitle,
    paperAspectRatio: .78,
    writingArea: { x: .13, y: .12, width: .74, height: .76 },
    paperBackground: "radial-gradient(circle at 35% 24%, rgba(255,250,213,.66), transparent 37%), repeating-linear-gradient(0deg, rgba(89,57,28,.055) 0 1px, transparent 1px 27px), #c9aa72",
    paperBorder: `10px solid ${cover}`,
    coverColor: cover,
    coverAccent: "#c8ad6a",
    ink: "#2a190e",
    replyInk: "#382115",
    writingDirection: "horizontal-tb",
    replyFontSize: 35
  };
}

function showCreateBook() {
  elements.createBookForm.reset();
  elements.createBookMessage.textContent = "";
  elements.createBookMessage.className = "form-message";
  elements.createBookDialog.showModal();
  elements.customBookTitle.focus();
}

function saveCustomBook(event) {
  event.preventDefault();
  try {
    const book = customBookStore.add({
      bookTitle: elements.customBookTitle.value,
      name: elements.customPersonaName.value,
      identity: elements.customIdentity.value,
      personality: elements.customPersonality.value,
      openingLine: elements.customOpeningLine.value,
      bookTone: elements.customBookTone.value,
      sigil: elements.customSigil.value
    });
    customBooks = customBookStore.load();
    renderArchive();
    elements.createBookMessage.textContent = `《${book.bookTitle}》已经放上书架。`;
    elements.createBookMessage.className = "form-message success";
    setTimeout(() => {
      elements.createBookDialog.close();
      const button = elements.personaList.querySelector(`[data-persona-id="${book.id}"]`);
      if (button) openBook(book.id, button);
    }, reducedMotion ? 0 : 520);
  } catch {
    elements.createBookMessage.textContent = "资料还不完整，请填写书名、人物身份和性格。";
    elements.createBookMessage.className = "form-message error";
  }
}

function registerLocalAppShell() {
  if (!("serviceWorker" in navigator) || !isSecureContext) return;
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}), { once: true });
}
