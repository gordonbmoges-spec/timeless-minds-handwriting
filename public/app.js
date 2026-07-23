import { PERSONAS, findPersona } from "/data/personas.js";
import { PERSONA_ASSETS, getPersonaAssets } from "/assets/personas/manifest.js";
import { requestAiStatus, requestPersonaReply } from "/modules/ai-client.js";
import { shouldCloseFromPinch, shouldOpenDrawerFromEdge } from "/modules/book-gestures.js";
import { createHistoryStore } from "/modules/history-store.js";
import { createCustomBookStore } from "/modules/custom-books.js";
import { createPersonaMemoryStore } from "/modules/persona-memory-store.js";
import { applyPersonaProfile, createPersonaProfileStore } from "/modules/persona-profile-store.js";
import { InkEngine } from "/modules/ink-engine.js";
import { ReplyPresenter } from "/modules/reply-presenter.js";
import { navigateTo, personaPath, routeFromPath } from "/modules/router.js";

const API_SETTINGS_KEY = "ink-diary-api-settings-v1";
const REPLY_PREFERENCE_PREFIX = "minds-archive-reply-preference-v1-";
const MOTION_MODE_KEY = "minds-archive-motion-mode-v2";
const SHELF_TRAVEL_MS = 1_650;
const REFERENCE_OPEN_MS = 5_600;
const REFERENCE_CLOSE_MS = 5_150;
const MIRROR_CLOSE_MS = 520;
const MIRROR_RETURN_MS = 1_450;
const BOOK_HANDOFF_FADE_DELAY_MS = 320;
const BOOK_HANDOFF_REMOVE_MS = 1_120;
const BOOK_RETURN_TRAVEL_MS = 1_650;
const BOOK_RETURN_CROSSFADE_MS = 180;
const REPLY_FONT_LOAD_TIMEOUT_MS = 2_200;
const IDLE_SEND_MS = 1_800;
const HISTORICAL_PERSONA_IDS = new Set(["confucius", "socrates", "da-vinci", "shakespeare", "jung", "einstein"]);
const GENERATED_COVER_IMAGES = Object.freeze({
  confucius: "/assets/magic/covers/confucius.webp",
  socrates: "/assets/magic/covers/socrates.webp",
  "da-vinci": "/assets/magic/covers/da-vinci.webp",
  shakespeare: "/assets/magic/covers/shakespeare.webp",
  jung: "/assets/magic/covers/jung.webp",
  einstein: "/assets/magic/covers/einstein.webp",
  "tom-riddle": "/assets/magic/covers/tom-riddle.webp",
  "human-parchment": "/assets/magic/covers/human-parchment.webp"
});
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const historyStore = createHistoryStore();
const personaMemoryStore = createPersonaMemoryStore();
const personaProfileStore = createPersonaProfileStore();
const customBookStore = createCustomBookStore();
let customBooks = customBookStore.load();
let apiSessionConfig = null;
let purgedLegacyApiSettings = false;
const replyFontPromises = new Map();

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
  "apiFormMessage", "replySettingsDialog", "replySettingsForm", "replySettingsTitle", "closeReplySettings",
  "clearReplySettings", "defaultPersonaIdentity", "defaultPersonaPersonality", "defaultPersonaOpeningLine", "personaIdentity",
  "personaPersonality", "personaOpeningLine", "personaInstruction", "personaMemory", "replyFormMessage", "historyDialog",
  "closeHistory", "clearHistory", "historyList", "historyTitle", "createBookDialog",
  "createBookForm", "closeCreateBook", "customBookTitle", "customPersonaName", "customIdentity",
  "customPersonality", "customMemory", "customOpeningLine", "createBookMessage",
  "bookDrawer", "toggleBookDrawer", "closeBookDrawer", "activeBookVolume", "activeBookTitle",
  "activeBookOwner", "pinchHint", "openingSequence", "openingFlipbook", "openingBookSigil", "openingBookTitle",
  "openingBookLatin", "motionMode", "openingHingeRig", "openingHingeCover", "openingHingeTitle"
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
  flipTimers: [],
  bookPortal: null,
  bookPortalTimers: [],
  bookOrigin: null,
  returningBook: null,
  aiStatus: { mode: "checking", model: "", source: "none" },
  motionMode: loadMotionMode()
};

applyMotionMode(state.motionMode);
renderArchive();
bindGlobalEvents();
handleRoute();
void refreshConnectionStatus();
registerLocalAppShell();

function loadMotionMode() {
  try {
    const saved = localStorage.getItem(MOTION_MODE_KEY);
    return ["crisp", "hinge", "legacy"].includes(saved) ? saved : "hinge";
  } catch {
    return "hinge";
  }
}

function applyMotionMode(mode) {
  const nextMode = ["crisp", "hinge", "legacy"].includes(mode) ? mode : "crisp";
  state.motionMode = nextMode;
  document.documentElement.dataset.bookMotion = nextMode;
  elements.archiveView.dataset.motion = nextMode;
  elements.sceneView.dataset.motion = nextMode;
  elements.motionMode.value = nextMode;
  try {
    localStorage.setItem(MOTION_MODE_KEY, nextMode);
  } catch {
    // The comparison control still works for this visit when storage is unavailable.
  }
}

function renderArchive() {
  const books = allPersonas();
  const entries = books.map((persona, index) => {
    const assets = getAvailableAssets(persona);
    const available = Boolean(assets);
    const button = document.createElement("button");
    const isMirror = persona.id === "magic-mirror";
    const generatedCoverImage = GENERATED_COVER_IMAGES[persona.id];
    const hasFlatCover = Boolean(generatedCoverImage || persona.isCustom);
    const displayTitle = HISTORICAL_PERSONA_IDS.has(persona.id) ? persona.name : (persona.bookTitle || persona.name);
    button.className = isMirror
      ? "mirror-card archive-entry"
      : hasFlatCover
        ? `archive-entry flat-cover-card${persona.isCustom ? " custom-cover-card" : ""}`
        : `book-card archive-entry book-${persona.bookTone || "archive"}`;
    button.type = "button";
    button.dataset.personaId = persona.id;
    button.setAttribute("aria-disabled", String(!available));
    button.setAttribute("aria-label", isMirror ? "唤醒魔镜，与魔镜对话" : `打开《${displayTitle}》，与${persona.name}对话`);

    if (isMirror) {
      const label = document.createElement("span");
      label.className = "mirror-entry-label";
      label.innerHTML = "魔镜<small>轻触唤醒</small>";
      button.append(label);
      button.addEventListener("click", () => {
        if (!available) return;
        openBook(persona.id, button);
      });
      return button;
    }

    const volume = document.createElement("span");
    volume.className = "book-volume";

    if (generatedCoverImage) {
      const bookImage = document.createElement("img");
      bookImage.className = "flat-cover-image flat-cover-visual";
      bookImage.src = generatedCoverImage;
      bookImage.alt = "";
      button.append(bookImage);
    } else if (persona.isCustom) {
      const customCover = document.createElement("span");
      customCover.className = "flat-cover-image flat-cover-visual custom-cover-visual";
      customCover.setAttribute("aria-hidden", "true");
      const monogram = document.createElement("i");
      monogram.textContent = persona.sigil || persona.name.slice(0, 1);
      customCover.append(monogram);
      button.append(customCover);
    }

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
    title.textContent = displayTitle;

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
  });

  const mirror = entries.find((entry) => entry.dataset.personaId === "magic-mirror");
  const shelfEntries = entries.filter((entry) => entry !== mirror && !findAvailablePersona(entry.dataset.personaId)?.isCustom);
  const customEntries = entries.filter((entry) => findAvailablePersona(entry.dataset.personaId)?.isCustom);
  const upperShelf = document.createElement("div");
  upperShelf.className = "book-shelf-row shelf-upper";
  upperShelf.append(...shelfEntries.slice(0, 5));
  const lowerShelf = document.createElement("div");
  lowerShelf.className = "book-shelf-row shelf-lower";
  lowerShelf.append(...shelfEntries.slice(5));
  const customShelf = document.createElement("div");
  customShelf.className = "book-shelf-row shelf-custom";
  customShelf.setAttribute("aria-label", "自定义书籍书架");
  const customSlots = customEntries.map((entry) => {
    const persona = findAvailablePersona(entry.dataset.personaId);
    const slot = document.createElement("div");
    const deleteButton = document.createElement("button");
    slot.className = "custom-book-slot";
    deleteButton.className = "custom-book-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `删除《${persona.bookTitle}》`);
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteCustomBook(persona);
    });
    slot.append(entry, deleteButton);
    return slot;
  });
  customShelf.append(...customSlots);
  elements.personaList.replaceChildren(...(mirror ? [mirror] : []), upperShelf, lowerShelf, customShelf);
}

function deleteCustomBook(persona) {
  if (!persona?.isCustom) return;
  const approved = confirm(`确定删除《${persona.bookTitle}》吗？\n这本书的记忆和对话记录也会一起删除。`);
  if (!approved) return;
  customBooks = customBookStore.remove(persona.id);
  personaMemoryStore.clear(persona.id);
  personaProfileStore.clear(persona.id);
  historyStore.clear(persona.id);
  try {
    localStorage.removeItem(`${REPLY_PREFERENCE_PREFIX}${persona.id}`);
  } catch {
    // Deletion still succeeds when private browsing blocks localStorage.
  }
  renderArchive();
}

async function openBook(personaId, button) {
  if (button.classList.contains("is-opening") || button.classList.contains("is-opening-pending")) return;
  const persona = findAvailablePersona(personaId);
  button.classList.add("is-opening-pending");
  button.setAttribute("aria-busy", "true");
  const coverReady = warmOpeningCover(persona);
  let hasBookPortal = false;
  try {
    const portalReady = !reducedMotion && Boolean(persona)
      ? createBookTransitionPortal(button, persona)
      : Promise.resolve(false);
    [hasBookPortal] = await Promise.all([portalReady, coverReady]);
  } catch {
    clearBookTransitionPortal();
  } finally {
    button.classList.remove("is-opening-pending");
    button.removeAttribute("aria-busy");
  }
  const books = [...elements.personaList.querySelectorAll(".archive-entry")];
  const selectedIndex = Math.max(0, books.indexOf(button));
  elements.personaList.classList.add("is-selecting-book");
  books.forEach((book, index) => {
    if (book === button) return;
    book.classList.add("is-receding");
    book.style.setProperty("--recede-delay", `${Math.min(280, 70 + Math.abs(index - selectedIndex) * 28)}ms`);
  });
  button.classList.add("is-opening");
  elements.archiveView.classList.add("is-opening-book");
  const delay = reducedMotion ? 0 : personaId === "magic-mirror" ? 1_260 : hasBookPortal ? SHELF_TRAVEL_MS : 1_520;
  setTimeout(() => {
    navigateTo(personaPath(personaId));
  }, delay);
}

async function warmOpeningCover(persona) {
  const source = GENERATED_COVER_IMAGES[persona?.id];
  if (!source) return;
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  if (typeof image.decode === "function") {
    await image.decode().catch(() => {});
  }
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForPortalPaint(portal) {
  const images = [...portal.querySelectorAll("img")];
  await Promise.allSettled(images.map((image) => {
    if (typeof image.decode === "function") return image.decode();
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
  await nextAnimationFrame();
  await nextAnimationFrame();
}

async function createBookTransitionPortal(button, persona) {
  const visual = button.querySelector(".flat-cover-visual");
  if (!visual) return false;
  clearBookTransitionPortal();

  const rect = button.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  state.bookOrigin = {
    personaId: persona.id,
    ratio: rect.width / rect.height
  };
  const ratio = rect.width / rect.height;
  const target = bookPortalTarget(ratio);
  const { width: targetWidth, height: targetHeight, left: targetLeft, top: targetTop } = target;
  const scale = targetWidth / rect.width;

  const portal = document.createElement("div");
  portal.className = "book-transition-portal is-priming";
  portal.dataset.motion = state.motionMode;
  portal.setAttribute("aria-hidden", "true");
  if (state.motionMode === "legacy") {
    portal.style.left = `${rect.left}px`;
    portal.style.top = `${rect.top}px`;
    portal.style.width = `${rect.width}px`;
    portal.style.height = `${rect.height}px`;
    portal.style.setProperty("--portal-x", `${targetLeft - rect.left}px`);
    portal.style.setProperty("--portal-y", `${targetTop - rect.top}px`);
    portal.style.setProperty("--portal-scale", String(scale));
    portal.style.setProperty("--portal-x-mid", `${(targetLeft - rect.left) * 0.26}px`);
    portal.style.setProperty("--portal-y-mid", `${(targetTop - rect.top) * 0.26}px`);
    portal.style.setProperty("--portal-scale-mid", String(1 + (scale - 1) * 0.26));
    portal.style.setProperty("--portal-x-late", `${(targetLeft - rect.left) * 0.7}px`);
    portal.style.setProperty("--portal-y-late", `${(targetTop - rect.top) * 0.7}px`);
    portal.style.setProperty("--portal-scale-late", String(1 + (scale - 1) * 0.7));
    portal.style.setProperty("--portal-label-end", `${Math.max(6.5, 42 / scale)}px`);
  } else {
    const startScale = rect.width / targetWidth;
    const startX = rect.left - targetLeft;
    const startY = rect.top - targetTop;
    portal.style.left = `${targetLeft}px`;
    portal.style.top = `${targetTop}px`;
    portal.style.width = `${targetWidth}px`;
    portal.style.height = `${targetHeight}px`;
    portal.style.setProperty("--portal-start-x", `${startX}px`);
    portal.style.setProperty("--portal-start-y", `${startY}px`);
    portal.style.setProperty("--portal-start-scale", String(startScale));
    portal.style.setProperty("--portal-x-early", `${startX * 0.96}px`);
    portal.style.setProperty("--portal-y-early", `${startY * 0.96 - 5}px`);
    portal.style.setProperty("--portal-scale-early", String(startScale + (1 - startScale) * 0.04));
    portal.style.setProperty("--portal-x-mid", `${startX * 0.74}px`);
    portal.style.setProperty("--portal-y-mid", `${startY * 0.74}px`);
    portal.style.setProperty("--portal-scale-mid", String(startScale + (1 - startScale) * 0.26));
    portal.style.setProperty("--portal-x-late", `${startX * 0.3}px`);
    portal.style.setProperty("--portal-y-late", `${startY * 0.3}px`);
    portal.style.setProperty("--portal-scale-late", String(startScale + (1 - startScale) * 0.7));
  }

  const cover = visual.cloneNode(true);
  cover.classList.add("portal-cover-visual");
  cover.setAttribute("aria-hidden", "true");
  const title = document.createElement("strong");
  title.textContent = persona.name;
  portal.append(cover, title);
  document.body.append(portal);
  state.bookPortal = portal;
  await waitForPortalPaint(portal);
  if (state.bookPortal !== portal || !portal.isConnected || !button.isConnected) return false;
  portal.classList.remove("is-priming");
  portal.classList.add("is-ready");
  await nextAnimationFrame();
  button.classList.add("is-portal-source");
  portal.classList.add("is-travelling");
  return true;
}

function clearBookTransitionPortal() {
  for (const timer of state.bookPortalTimers) clearTimeout(timer);
  state.bookPortalTimers = [];
  state.bookPortal?.remove();
  state.bookPortal = null;
  for (const source of elements.personaList.querySelectorAll(".is-portal-source")) {
    source.classList.remove("is-portal-source");
  }
}

function bookPortalTarget(ratio) {
  const width = Math.min(500, innerWidth * 0.5, innerHeight * 0.9 * ratio);
  const height = width / ratio;
  return {
    width,
    height,
    left: (innerWidth - width) / 2,
    top: (innerHeight - height) / 2
  };
}

async function createBookReturnPortal(persona) {
  const source = GENERATED_COVER_IMAGES[persona?.id];
  if (!source && !persona?.isCustom) return false;
  clearBookTransitionPortal();
  const ratio = state.bookOrigin?.personaId === persona.id ? state.bookOrigin.ratio : 2 / 3;
  const rect = bookPortalTarget(ratio);
  const portal = document.createElement("div");
  portal.className = "book-transition-portal book-return-portal is-priming";
  portal.dataset.motion = state.motionMode;
  portal.setAttribute("aria-hidden", "true");
  portal.style.left = `${rect.left}px`;
  portal.style.top = `${rect.top}px`;
  portal.style.width = `${rect.width}px`;
  portal.style.height = `${rect.height}px`;

  let cover;
  if (source) {
    cover = document.createElement("img");
    cover.src = source;
    cover.alt = "";
  } else {
    cover = document.createElement("span");
    cover.className = "flat-cover-image flat-cover-visual custom-cover-visual portal-cover-visual";
    cover.setAttribute("aria-hidden", "true");
    const monogram = document.createElement("i");
    monogram.textContent = persona.sigil || persona.name.slice(0, 1);
    cover.append(monogram);
  }
  const title = document.createElement("strong");
  title.textContent = persona.bookTitle || persona.name;
  portal.append(cover, title);
  document.body.append(portal);
  state.bookPortal = portal;
  await waitForPortalPaint(portal);
  if (state.bookPortal !== portal || !portal.isConnected) return false;
  portal.classList.add("is-ready");
  portal.classList.remove("is-priming");
  await nextAnimationFrame();
  await nextAnimationFrame();
  state.returningBook = { personaId: persona.id };
  return true;
}

function createMirrorReturnPortal(persona) {
  if (persona?.id !== "magic-mirror" || !state.assets?.background) return false;
  clearBookTransitionPortal();
  const portal = document.createElement("div");
  portal.className = "mirror-return-portal";
  portal.setAttribute("aria-hidden", "true");
  portal.style.backgroundImage = `url("${state.assets.background}")`;
  portal.style.backgroundPosition = state.assets.backgroundFocus || "center";
  document.body.append(portal);
  state.bookPortal = portal;
  state.returningBook = { personaId: persona.id };
  return true;
}

function finishBookReturnToShelf() {
  const returning = state.returningBook;
  const portal = state.bookPortal;
  if (!returning || !portal) return;
  const isMirrorReturn = portal.classList.contains("mirror-return-portal");
  if (isMirrorReturn) {
    requestAnimationFrame(() => portal.classList.add("is-returning"));
    state.bookPortalTimers.push(setTimeout(() => {
      elements.archiveView.classList.remove("is-mirror-returning");
      state.returningBook = null;
      clearBookTransitionPortal();
    }, MIRROR_RETURN_MS));
    return;
  }
  const target = elements.personaList.querySelector(`[data-persona-id="${returning.personaId}"]`);
  if (!target) {
    state.returningBook = null;
    clearBookTransitionPortal();
    return;
  }
  const sourceRect = portal.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (!sourceRect.width || !targetRect.width) {
    state.returningBook = null;
    clearBookTransitionPortal();
    return;
  }
  target.classList.add("is-return-target");
  elements.personaList.classList.add("is-returning-book");
  const returnX = targetRect.left - sourceRect.left;
  const returnY = targetRect.top - sourceRect.top;
  const returnScale = targetRect.width / sourceRect.width;
  portal.style.setProperty("--return-x", `${returnX}px`);
  portal.style.setProperty("--return-y", `${returnY}px`);
  portal.style.setProperty("--return-scale", String(returnScale));
  portal.style.setProperty("--return-label-end", `${Math.max(9, 12 / returnScale)}px`);
  requestAnimationFrame(() => portal.classList.add("is-returning"));
  state.bookPortalTimers.push(setTimeout(async () => {
    if (state.bookPortal !== portal || state.returningBook !== returning) return;
    elements.personaList.classList.remove("is-returning-book");
    target.classList.remove("is-return-target");
    await nextAnimationFrame();
    await nextAnimationFrame();
    if (state.bookPortal !== portal || state.returningBook !== returning) return;
    portal.classList.add("is-settling");
    state.bookPortalTimers.push(setTimeout(() => {
      if (state.bookPortal !== portal || state.returningBook !== returning) return;
      state.returningBook = null;
      state.bookOrigin = null;
      clearBookTransitionPortal();
    }, BOOK_RETURN_CROSSFADE_MS));
  }, BOOK_RETURN_TRAVEL_MS));
}

function handOffBookTransitionPortal() {
  if (!state.bookPortal) return;
  const portal = state.bookPortal;
  state.bookPortalTimers.push(setTimeout(() => portal.classList.add("is-handing-off"), BOOK_HANDOFF_FADE_DELAY_MS));
  state.bookPortalTimers.push(setTimeout(clearBookTransitionPortal, BOOK_HANDOFF_REMOVE_MS));
}

function resetArchiveSelection() {
  elements.archiveView.classList.remove("is-opening-book");
  elements.personaList.classList.remove("is-selecting-book");
  for (const book of elements.personaList.querySelectorAll(".archive-entry")) {
    book.classList.remove("is-opening", "is-opening-pending", "is-receding");
    book.removeAttribute("aria-busy");
    book.style.removeProperty("--recede-delay");
  }
}

function bindGlobalEvents() {
  addEventListener("popstate", handleRoute);
  elements.motionMode.addEventListener("change", () => applyMotionMode(elements.motionMode.value));
  elements.backToArchive.addEventListener("click", closeBookToShelf);
  elements.mobileBack.addEventListener("click", closeBookToShelf);
  elements.toggleBookDrawer.addEventListener("click", toggleBookDrawer);
  elements.closeBookDrawer.addEventListener("click", () => setBookDrawer(false));
  elements.sceneView.addEventListener("pointerdown", trackBookGesture, true);
  elements.sceneView.addEventListener("pointermove", trackBookGesture, true);
  elements.sceneView.addEventListener("pointerup", endBookGesture, true);
  elements.sceneView.addEventListener("pointercancel", endBookGesture, true);
  for (const eventName of ["contextmenu", "selectstart", "dragstart"]) {
    elements.writingSurface.addEventListener(eventName, preventNativeWritingSelection);
  }
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
  const isReturningBook = Boolean(state.returningBook && state.bookPortal);
  const isReturningMirror = isReturningBook && state.returningBook?.personaId === "magic-mirror";
  teardownScene();
  if (!isReturningBook) clearBookTransitionPortal();
  resetArchiveSelection();
  state.persona = null;
  state.assets = null;
  elements.sceneView.hidden = true;
  elements.archiveView.hidden = false;
  elements.archiveView.classList.remove("is-entering");
  requestAnimationFrame(() => elements.archiveView.classList.add("is-entering"));
  elements.archiveView.classList.toggle("is-mirror-returning", isReturningMirror);
  elements.sceneView.classList.remove("is-revealed", "is-book-opening", "is-closing-book", "is-closing-to-shelf", "is-pinching", "drawer-open", "scene-mirror", "has-generated-cover", "has-custom-cover", "is-handoff-opening");
  elements.bookDrawer.setAttribute("aria-hidden", "true");
  elements.bookDrawer.inert = true;
  elements.toggleBookDrawer.setAttribute("aria-expanded", "false");
  state.closing = false;
  document.title = "魔法书柜";
  if (isReturningBook) requestAnimationFrame(finishBookReturnToShelf);
}

function showScene(persona, assets) {
  const hasBookHandoff = Boolean(state.bookPortal);
  teardownScene();
  state.persona = persona;
  state.assets = assets;
  state.history = historyStore.load(persona.id);
  elements.archiveView.hidden = true;
  elements.sceneView.hidden = false;
  elements.sceneView.classList.remove("is-book-opening", "is-closing-book", "is-pinching", "drawer-open", "scene-mirror", "has-generated-cover", "has-custom-cover", "is-handoff-opening");
  elements.sceneView.classList.toggle("scene-mirror", persona.id === "magic-mirror");
  elements.sceneView.classList.toggle("is-handoff-opening", hasBookHandoff);
  elements.sceneView.dataset.motion = state.motionMode;
  const generatedCoverImage = GENERATED_COVER_IMAGES[persona.id];
  elements.sceneView.classList.toggle("has-generated-cover", Boolean(generatedCoverImage));
  elements.sceneView.classList.toggle("has-custom-cover", Boolean(persona.isCustom));
  elements.sceneView.style.setProperty("--opening-cover-image", generatedCoverImage ? `url("${generatedCoverImage}")` : "none");
  const openingRatio = state.bookOrigin?.personaId === persona.id ? state.bookOrigin.ratio : 2 / 3;
  elements.sceneView.style.setProperty("--opening-closed-width", `${bookPortalTarget(openingRatio).width}px`);
  void resolveReplyFont(persona.openingLine, assets.replyFontSize || 36);
  elements.bookDrawer.inert = true;
  state.closing = false;
  const isMirror = persona.id === "magic-mirror";
  elements.backToArchive.textContent = isMirror ? "离开魔镜，返回魔法书柜" : "合上并放回书架";
  elements.pinchHint.textContent = isMirror ? "双指向内收拢 · 离开魔镜" : "双指向内收拢 · 合上书籍";
  updateConnectionCopy();
  document.title = `${persona.name} · 魔法书柜`;

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
  elements.sceneLocation.textContent = persona.name;
  elements.sceneTitle.textContent = persona.name;
  const volumeNumber = allPersonas().findIndex((book) => book.id === persona.id) + 1;
  elements.activeBookVolume.textContent = `VOL. ${String(volumeNumber).padStart(2, "0")}`;
  elements.activeBookTitle.textContent = persona.name;
  elements.activeBookOwner.textContent = "";
  elements.openingBookSigil.textContent = assets.sigil || persona.sigil || persona.name.slice(0, 1);
  elements.openingBookTitle.textContent = persona.name;
  elements.openingBookLatin.textContent = persona.latinName;
  elements.openingHingeTitle.textContent = persona.bookTitle || persona.name;
  elements.paperObject.classList.remove("book-unfolding");
  elements.paperObject.dataset.bookTitle = persona.name;
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
    if (hasBookHandoff) handOffBookTransitionPortal();
    state.openingTimer = setTimeout(() => {
      elements.sceneView.classList.remove("is-book-opening", "is-handoff-opening");
      state.openingTimer = null;
      showOpeningLine();
    }, reducedMotion ? 0 : state.motionMode === "hinge" ? REFERENCE_OPEN_MS : 4_350);
  });
  requestAnimationFrame(setupSceneEngines);
  setStatus("等待书写");
  setTool("pen");
}

function toggleBookDrawer() {
  setBookDrawer(!elements.sceneView.classList.contains("drawer-open"));
}

function preventNativeWritingSelection(event) {
  event.preventDefault();
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
  if (!["touch", "mouse"].includes(event.pointerType) || elements.sceneView.hidden || state.closing) return;
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
  if (!["touch", "mouse"].includes(event.pointerType)) return;
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
  const canReturnToShelf = !reducedMotion
    && state.persona?.id !== "magic-mirror"
    && Boolean(GENERATED_COVER_IMAGES[state.persona?.id] || state.persona?.isCustom);
  elements.sceneView.classList.toggle("is-closing-to-shelf", canReturnToShelf);
  elements.sceneView.classList.remove("is-book-opening");
  elements.sceneView.classList.remove("is-pinching");
  const isMirror = state.persona?.id === "magic-mirror";
  if (isMirror && !reducedMotion) {
    setTimeout(() => {
      if (!state.persona || !createMirrorReturnPortal(state.persona)) {
        navigateTo("/");
        return;
      }
      navigateTo("/");
    }, MIRROR_CLOSE_MS);
    return;
  }
  if (!reducedMotion && state.pageFlip) {
    state.flipTimers.push(setTimeout(() => state.pageFlip?.flipPrev("bottom"), 100));
    state.flipTimers.push(setTimeout(() => state.pageFlip?.flipPrev("top"), 850));
  }
  if (canReturnToShelf) {
    state.flipTimers.push(setTimeout(async () => {
      if (!state.persona || !await createBookReturnPortal(state.persona)) {
        navigateTo("/");
        return;
      }
      navigateTo("/");
    }, REFERENCE_CLOSE_MS));
    return;
  }
  setTimeout(() => navigateTo("/"), reducedMotion ? 0 : 2_850);
}

function setupOpeningFlipbook() {
  clearFlipTimers();
  if (state.persona?.id === "magic-mirror") {
    disposePageFlip();
    return;
  }
  if (state.motionMode === "hinge") {
    disposePageFlip();
    return;
  }
  if (reducedMotion || !globalThis.St?.PageFlip || !elements.openingFlipbook) return;
  disposePageFlip();
  resetFlipbookMarkup();

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
    flippingTime: 1_280,
    usePortrait: true,
    startZIndex: 1,
    autoSize: true,
    maxShadowOpacity: 0.58,
    showCover: true,
    mobileScrollSupport: false,
    useMouseEvents: true,
    disableFlipByClick: true
  });
  state.pageFlip = pageFlip;
  pageFlip.on("init", () => {
    if (state.pageFlip !== pageFlip || state.closing) return;
    state.flipTimers.push(setTimeout(() => pageFlip.flipNext("top"), 940));
    state.flipTimers.push(setTimeout(() => pageFlip.flipNext("bottom"), 2_720));
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
    state.pageFlip.getUI().destroy();
  } catch (error) {
    console.warn("Page flip cleanup failed", error);
  }
  state.pageFlip = null;
  resetFlipbookMarkup();
}

function resetFlipbookMarkup() {
  const root = elements.openingFlipbook;
  if (!root) return;
  root.querySelector(":scope > .stf__wrapper")?.remove();
  root.classList.remove("stf__parent");
  root.removeAttribute("style");
  for (const page of root.querySelectorAll(":scope > .opening-flip-page")) {
    page.classList.remove("stf__item", "--hard", "--soft", "--left", "--right", "--simple");
    page.removeAttribute("style");
  }
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
  showReplyWithLoadedFont(state.persona.openingLine, {
    direction: state.assets.writingDirection,
    align: "center",
    topRatio: state.assets.replyTopRatio || 0.08,
    maxWidthRatio: state.assets.replyMaxWidthRatio || 0.82,
    color: state.assets.replyInk,
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
      personaProfile: state.persona.isCustom ? null : {
        identity: state.persona.identity || state.persona.name || "",
        personality: state.persona.personality || ""
      },
      customPersona: state.persona.isCustom ? {
        name: state.persona.name,
        bookTitle: state.persona.bookTitle,
        identity: state.persona.identity,
        personality: state.persona.personality
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
    updateConnectionCopy(data.diagnostics || { mode: data.mode });
    setStatus(
      data.status === "demo_unavailable"
        ? "需要配置 AI"
        : data.status === "needs_clarification"
          ? "请再写一次"
          : "正在回信",
      data.status === "demo_unavailable" ? "error" : "busy"
    );
    await showReplyWithLoadedFont(data.reply || "", {
      direction: state.assets.writingDirection,
      align: "center",
      topRatio: state.assets.replyTopRatio || 0.08,
      maxWidthRatio: state.assets.replyMaxWidthRatio || 0.82,
      color: state.assets.replyInk,
      fontSize: state.assets.replyFontSize || 36,
      pace: data.style?.pace || 1
    });
    if (data.status !== "demo_unavailable") setStatus("等待书写");
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
  state.aiStatus = { mode: "ai", model: config.model, source: "session" };
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
  void refreshConnectionStatus();
  showApiFormMessage("页面配置已清除，将使用服务器配置或演示模式。", "success");
}

function readApiSettings() {
  if (!purgedLegacyApiSettings) {
    try { localStorage.removeItem(API_SETTINGS_KEY); } catch {}
    purgedLegacyApiSettings = true;
  }
  return apiSessionConfig;
}

function updateConnectionCopy(diagnostics = null) {
  if (diagnostics) {
    state.aiStatus = {
      mode: diagnostics.mode === "ai" ? "ai" : "demo",
      model: String(diagnostics.model || ""),
      source: String(diagnostics.source || "none")
    };
  }
  const config = readApiSettings();
  const activeStatus = config
    ? { mode: "ai", model: config.model, source: "session" }
    : state.aiStatus;
  const activeProfile = state.persona && !state.persona.isCustom ? {
    identity: state.persona.identity || state.persona.name || "",
    personality: state.persona.personality || ""
  } : null;
  const profileApplied = diagnostics ? Boolean(diagnostics.profileApplied) : Boolean(activeProfile);
  const appliedFields = diagnostics?.profileFieldsApplied || {
    identity: Boolean(activeProfile?.identity),
    personality: Boolean(activeProfile?.personality),
    openingLine: false
  };
  const appliedFieldCopy = [
    appliedFields.identity ? "身份" : "",
    appliedFields.personality ? "口吻" : "",
    appliedFields.openingLine ? "开场白" : ""
  ].filter(Boolean).join("、");
  const memoryApplied = diagnostics ? Boolean(diagnostics.memoryApplied) : Boolean(state.persona && readPersonaMemory(state.persona.id));
  const personaCopy = (aiActive) => state.persona
    ? ` · 当前设定：${profileApplied ? (aiActive ? `已发送（${appliedFieldCopy || "人物资料"}）` : "修改版已保存，等待真实 AI") : "原始设定"} · 长期记忆：${memoryApplied ? (aiActive ? "已发送" : "已保存，等待真实 AI") : "空"}`
    : "";

  if (activeStatus.mode === "ai") {
    const sourceCopy = activeStatus.source === "session" ? "页面 AI" : "服务器 AI";
    elements.modeCopy.textContent = `${sourceCopy} · ${activeStatus.model || "视觉模型"}${personaCopy(true)}`;
    return;
  }
  if (activeStatus.mode === "demo") {
    elements.modeCopy.textContent = `演示模式 · 不会识别手写，也不会调用人物设定和记忆${personaCopy(false)}`;
    return;
  }
  elements.modeCopy.textContent = `正在检查 AI 连接${personaCopy(false)}`;
}

async function refreshConnectionStatus() {
  if (readApiSettings()) {
    updateConnectionCopy();
    return;
  }
  try {
    const status = await requestAiStatus();
    state.aiStatus = {
      mode: status.mode === "ai" ? "ai" : "demo",
      model: String(status.model || ""),
      source: String(status.source || "none")
    };
  } catch {
    state.aiStatus = { mode: "demo", model: "", source: "none" };
  }
  updateConnectionCopy();
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
  const original = findOriginalPersona(state.persona.id);
  const savedProfile = personaProfileStore.load(state.persona.id);
  const originalIdentity = original?.identity || "这本书尚未记录原始身份背景。";
  const originalPersonality = original?.personality || "这本书尚未记录原始性格与回答口吻。";
  const originalOpeningLine = original?.openingLine || "这本书尚未记录原始开场白。";
  elements.defaultPersonaIdentity.textContent = originalIdentity;
  elements.defaultPersonaPersonality.textContent = originalPersonality;
  elements.defaultPersonaOpeningLine.textContent = originalOpeningLine;
  elements.personaIdentity.value = savedProfile?.identity || original?.identity || "";
  elements.personaPersonality.value = savedProfile?.personality || original?.personality || "";
  elements.personaOpeningLine.value = savedProfile && Object.prototype.hasOwnProperty.call(savedProfile, "openingLine")
    ? savedProfile.openingLine
    : (original?.openingLine || "");
  elements.personaInstruction.value = readReplyPreference(state.persona.id);
  elements.personaMemory.value = readPersonaMemory(state.persona.id);
  elements.replySettingsTitle.textContent = `${state.persona.name} · 人物设定与记忆`;
  elements.replyFormMessage.textContent = "";
  elements.replyFormMessage.className = "form-message";
  elements.replySettingsDialog.showModal();
  elements.personaIdentity.focus();
}

function saveReplyPreference(event) {
  event.preventDefault();
  if (!state.persona) return;
  const original = findOriginalPersona(state.persona.id);
  const identity = elements.personaIdentity.value.replace(/\s+/g, " ").trim().slice(0, 500);
  const personality = elements.personaPersonality.value.replace(/\s+/g, " ").trim().slice(0, 500);
  const openingLine = elements.personaOpeningLine.value.replace(/\s+/g, " ").trim().slice(0, 120);
  const value = elements.personaInstruction.value.replace(/\s+/g, " ").trim().slice(0, 300);
  const memory = elements.personaMemory.value.replace(/\s+/g, " ").trim().slice(0, 600);
  try {
    const profileIsDefault = identity === (original?.identity || "")
      && personality === (original?.personality || "")
      && openingLine === (original?.openingLine || "");
    const profileSaved = profileIsDefault
      ? personaProfileStore.clear(state.persona.id)
      : personaProfileStore.save(state.persona.id, { identity, personality, openingLine });
    if (!profileSaved) throw new Error("profile_not_saved");
    if (value) localStorage.setItem(`${REPLY_PREFERENCE_PREFIX}${state.persona.id}`, value);
    else localStorage.removeItem(`${REPLY_PREFERENCE_PREFIX}${state.persona.id}`);
    if (!personaMemoryStore.save(state.persona.id, memory)) throw new Error("memory_not_saved");
  } catch {
    showReplyFormMessage("浏览器不允许保存这项设置。", "error");
    return;
  }
  elements.personaIdentity.value = identity;
  elements.personaPersonality.value = personality;
  elements.personaOpeningLine.value = openingLine;
  elements.personaInstruction.value = value;
  elements.personaMemory.value = memory;
  state.persona = findAvailablePersona(state.persona.id);
  updateConnectionCopy();
  showReplyFormMessage("人物设定、回复偏好与长期记忆已保存。", "success");
  setTimeout(() => elements.replySettingsDialog.close(), reducedMotion ? 0 : 500);
}

function clearSavedReplyPreference() {
  if (!state.persona) return;
  const original = findOriginalPersona(state.persona.id);
  try { localStorage.removeItem(`${REPLY_PREFERENCE_PREFIX}${state.persona.id}`); } catch {}
  personaProfileStore.clear(state.persona.id);
  elements.personaIdentity.value = original?.identity || "";
  elements.personaPersonality.value = original?.personality || "";
  elements.personaOpeningLine.value = original?.openingLine || "";
  elements.personaInstruction.value = "";
  state.persona = findAvailablePersona(state.persona.id);
  updateConnectionCopy();
  showReplyFormMessage("已恢复原始身份、性格、开场白与默认回复方式；长期记忆仍然保留。", "success");
}

function readReplyPreference(personaId) {
  try { return String(localStorage.getItem(`${REPLY_PREFERENCE_PREFIX}${personaId}`) || "").slice(0, 300); }
  catch { return ""; }
}

function readPersonaMemory(personaId) {
  return personaMemoryStore.load(personaId);
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

function replyFontKind(text) {
  const value = String(text || "");
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  const cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
  return latin > cjk ? "latin" : "cjk";
}

async function loadReplyFont(family, fontSize, sample) {
  if (!document.fonts?.load || !document.fonts?.check) return false;
  const descriptor = `${fontSize}px "${family}"`;
  if (document.fonts.check(descriptor, sample)) return true;
  try {
    await Promise.race([
      document.fonts.load(descriptor, sample),
      wait(REPLY_FONT_LOAD_TIMEOUT_MS)
    ]);
  } catch {
    return false;
  }
  return document.fonts.check(descriptor, sample);
}

function resolveReplyFont(text, fontSize) {
  const kind = replyFontKind(text);
  const cached = replyFontPromises.get(kind);
  if (cached) return cached;
  const sample = kind === "latin" ? "The quick brown fox answers." : "魔法书柜";
  const promise = (async () => {
    if (kind === "latin") {
      if (await loadReplyFont("Dancing Script", fontSize, sample)) return '"Dancing Script", cursive';
      if (await loadReplyFont("IM FELL English", fontSize, sample)) return '"IM FELL English", Georgia, serif';
      return "Georgia, serif";
    }
    if (await loadReplyFont("ZCOOL XiaoWei", fontSize, sample)) return '"ZCOOL XiaoWei", "Kaiti SC", serif';
    return '"Kaiti SC", "STKaiti", "KaiTi", serif';
  })();
  replyFontPromises.set(kind, promise);
  return promise;
}

async function showReplyWithLoadedFont(text, options) {
  const presenter = state.reply;
  const personaId = state.persona?.id;
  const fontSize = options.fontSize || 36;
  const fontFamily = await resolveReplyFont(text, fontSize);
  if (!presenter || presenter !== state.reply || personaId !== state.persona?.id) return;
  return presenter.show(text, { ...options, fontFamily });
}

function bookCoverColor(tone) {
  return {
    jade: "#203c32", marble: "#5c5c54", umber: "#5a351f", wine: "#51212a",
    crimson: "#5d171c", midnight: "#17283a", silver: "#273237", obsidian: "#17130f",
    parchment: "#4a2e1c"
  }[tone] || "#2c2a22";
}

function allPersonas() {
  return [...PERSONAS, ...customBooks].map((persona) => applyPersonaProfile(persona, personaProfileStore.load(persona.id)));
}

function findAvailablePersona(id) {
  const persona = findOriginalPersona(id);
  return persona ? applyPersonaProfile(persona, personaProfileStore.load(persona.id)) : null;
}

function findOriginalPersona(id) {
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
      bookTone: "obsidian",
      sigil: elements.customPersonaName.value.trim().slice(0, 1)
    });
    personaMemoryStore.save(book.id, elements.customMemory.value);
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
