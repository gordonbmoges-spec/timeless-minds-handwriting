import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildCustomPersonaPrompt, buildPersonaPrompt, getPersona } from "./lib/personas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPublicDir = path.join(__dirname, "public");
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-68ovwuVEgP4KP6803CNhdg6S0jCfEydjM4sM/Qdnc5o='; script-src 'self'; connect-src 'self'; worker-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
});

export function createInkDiaryServer(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const logger = options.logger ?? console;
  const publicDir = options.publicDir ?? defaultPublicDir;

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "POST" && url.pathname === "/api/reply") {
        await handleReply(req, res, { env, fetchImpl, logger });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        sendJson(res, 200, publicAiStatus(resolveApiConfig({}, env)));
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        await serveStatic(url.pathname, res, req.method === "HEAD", publicDir);
        return;
      }

      sendJson(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      logger.error?.("Ink Diary server error", { message: error?.message || "unknown" });
      sendJson(res, 500, { error: "server_error", message: "纸页暂时安静了，请稍后重试。" });
    }
  });
}

export function startInkDiaryServer(options = {}) {
  loadEnv(path.join(__dirname, ".env"));
  const env = options.env ?? process.env;
  const initialPort = Number(options.port ?? env.PORT ?? 3107);
  const server = createInkDiaryServer({ ...options, env });
  let selectedPort = initialPort;

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && selectedPort < initialPort + 20) {
      selectedPort += 1;
      options.logger?.log?.(`Port ${selectedPort - 1} is busy, trying ${selectedPort}...`);
      setTimeout(() => server.listen(selectedPort), 80);
      return;
    }
    throw error;
  });

  server.on("listening", () => {
    const logger = options.logger ?? console;
    logger.log?.(`Ink Diary MVP running at http://localhost:${selectedPort}`);
  });

  server.listen(selectedPort);
  return server;
}

async function handleReply(req, res, dependencies) {
  const body = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const imageDataUrl = String(payload.imageDataUrl || "");
  if (!imageDataUrl.startsWith("data:image/png;base64,")) {
    sendJson(res, 400, { error: "missing_png" });
    return;
  }

  const registeredPersona = getPersona(payload.personaId);
  const customPersona = normalizeCustomPersona(payload.personaId, payload.customPersona);
  const persona = registeredPersona || customPersona;
  if (!persona) {
    sendJson(res, 400, { error: "invalid_persona" });
    return;
  }

  const style = normalizeStyle(payload.style);
  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const personaInstruction = cleanText(payload.personaInstruction || "", 300);
  const personaMemory = cleanText(payload.personaMemory || "", 600);
  const personaProfile = registeredPersona ? normalizePersonaProfile(payload.personaProfile) : null;
  const apiConfig = resolveApiConfig(payload.apiConfig, dependencies.env);
  const { key, baseUrl, model } = apiConfig;
  const diagnostics = replyDiagnostics({ apiConfig, persona, personaProfile, personaMemory, history });

  if (!key) {
    sendJson(res, 200, demoReply(persona, style, diagnostics));
    return;
  }

  const readingPrompt = [
    "识别图片中的手写文字，并结合系统消息中的人物设定、长期记忆和最近对话作答。",
    "只返回 JSON 对象，包含 transcript 和 reply 两个字符串字段。",
    "transcript 是识别到的手写原文；无法识别时为空字符串。",
    "reply 是人物的回答；无法识别时为空字符串。"
  ].filter(Boolean).join("\n\n");

  const personaSystemPrompt = [
    registeredPersona ? buildPersonaPrompt(persona.id, personaProfile) : buildCustomPersonaPrompt(persona),
    personaInstruction ? `补充回复偏好：${personaInstruction}` : "",
    personaMemory ? `长期记忆：${personaMemory}` : "",
    history.length ? `最近对话历史：\n${formatHistory(history)}` : "",
    "只返回包含 transcript 和 reply 的 JSON 对象。"
  ].filter(Boolean).join("\n");

  const apiRes = await dependencies.fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.72,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: personaSystemPrompt
        },
        {
          role: "user",
          content: [
            { type: "text", text: readingPrompt },
            { type: "image_url", image_url: { url: imageDataUrl } }
          ]
        }
      ]
    })
  });

  const raw = await apiRes.text();
  if (!apiRes.ok) {
    dependencies.logger.error?.("AI request failed", { status: apiRes.status, personaId: persona.id });
    sendJson(res, apiRes.status, {
      error: "ai_request_failed",
      message: "模型服务拒绝了请求，请检查 Key、模型和接口地址。"
    });
    return;
  }

  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(content);
  const transcript = cleanText(parsed.transcript || "", 900);

  if (!transcript) {
    sendJson(res, 200, {
      mode: "ai",
      status: "needs_clarification",
      personaId: persona.id,
      transcript: "",
      reply: persona.clarificationReply,
      style,
      diagnostics
    });
    return;
  }

  const reply = cleanReply(parsed.reply || persona.clarificationReply);

  sendJson(res, 200, {
    mode: "ai",
    status: "ok",
    personaId: persona.id,
    transcript,
    reply,
    style,
    diagnostics
  });
}

async function serveStatic(pathname, res, headOnly, publicDir) {
  const cleanPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const requested = path.normalize(path.join(publicDir, cleanPath));
  if (!requested.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const file = await readFile(requested);
    const shouldRevalidate = /\.(?:html|css|js)$/.test(requested);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "Content-Type": mimeType(requested),
      "Cache-Control": shouldRevalidate ? "no-store" : "public, max-age=3600"
    });
    if (!headOnly) res.end(file);
    else res.end();
  } catch {
    if (!path.extname(cleanPath)) {
      try {
        const shell = await readFile(path.join(publicDir, "index.html"));
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        if (!headOnly) res.end(shell);
        else res.end();
        return;
      } catch {
        // Fall through to the normal not-found response.
      }
    }
    sendText(res, 404, "Not found");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8"
  }[ext] || "application/octet-stream";
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function cleanText(value, maxLength) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanReply(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCustomPersona(personaId, value) {
  const id = cleanText(personaId || "", 72);
  if (!/^custom-[a-z0-9-]{6,64}$/.test(id) || !value || typeof value !== "object") return null;
  const persona = {
    id,
    name: cleanText(value.name || "", 36),
    bookTitle: cleanText(value.bookTitle || "", 36),
    identity: cleanText(value.identity || "", 180),
    personality: cleanText(value.personality || "", 260)
  };
  if (!persona.name || !persona.bookTitle || !persona.identity || !persona.personality) return null;
  persona.demoReply = `我是${persona.name}。把你的问题写下来吧。`;
  persona.clarificationReply = "字迹还没有成为一个完整的问题。请再写一次。";
  return persona;
}

function normalizePersonaProfile(value) {
  if (!value || typeof value !== "object") return null;
  const identity = cleanText(value.identity || "", 500);
  const personality = cleanText(value.personality || "", 500);
  if (!identity && !personality) return null;
  return { identity, personality };
}

function normalizeStyle(style = {}) {
  return {
    inkWidth: clamp(Number(style.inkWidth) || 3, 1, 12),
    slant: clamp(Number(style.slant) || 0, -0.35, 0.35),
    letterSize: clamp(Number(style.letterSize) || 42, 26, 68),
    pace: clamp(Number(style.pace) || 1, 0.65, 1.6)
  };
}

function resolveApiConfig(clientConfig = {}, env = {}) {
  const clientKey = cleanConfigValue(clientConfig.apiKey, 512);
  const clientBaseUrl = cleanConfigValue(clientConfig.baseUrl, 1000);
  const clientModel = cleanConfigValue(clientConfig.model, 200);

  if (clientKey && clientBaseUrl && clientModel && isAllowedApiUrl(clientBaseUrl)) {
    return {
      key: clientKey,
      baseUrl: clientBaseUrl.replace(/\/+$/, ""),
      model: clientModel,
      source: "session"
    };
  }

  return {
    key: env.AI_API_KEY || env.OPENAI_API_KEY || env.DASHSCOPE_API_KEY || env.RIDDLE_OPENAI_KEY,
    baseUrl: (env.AI_BASE_URL || env.OPENAI_BASE_URL || env.DASHSCOPE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: env.AI_MODEL || env.OPENAI_MODEL || "qwen3-vl-plus",
    source: "server"
  };
}

function cleanConfigValue(value, maxLength) {
  return String(value || "").replace(/[\r\n]/g, "").trim().slice(0, maxLength);
}

function isAllowedApiUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol !== "https:") return false;
    return !isPrivateHostname(url.hostname);
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function demoReply(persona, style, diagnostics) {
  return {
    mode: "demo",
    status: "demo_unavailable",
    personaId: persona.id,
    transcript: "",
    reply: "演示模式不能识别手写内容，也无法判断你写的是中文还是英文。请先配置视觉模型。 Demo mode cannot read handwriting or detect its language. Configure a vision model first.",
    style,
    diagnostics
  };
}

function publicAiStatus(apiConfig) {
  return {
    mode: apiConfig.key ? "ai" : "demo",
    model: apiConfig.key ? apiConfig.model : "",
    source: apiConfig.key ? apiConfig.source : "none"
  };
}

function replyDiagnostics({ apiConfig, persona, personaProfile, personaMemory, history }) {
  return {
    ...publicAiStatus(apiConfig),
    personaId: persona.id,
    profileApplied: Boolean(personaProfile),
    profileFieldsApplied: {
      identity: Boolean(personaProfile?.identity),
      personality: Boolean(personaProfile?.personality),
      openingLine: false
    },
    memoryApplied: Boolean(personaMemory),
    historyTurns: history.length
  };
}

function formatHistory(history) {
  return history.map((turn) => {
    const user = cleanText(turn.transcript || "", 300);
    const reply = cleanReply(turn.reply || "");
    return `User wrote: ${user}\nNotebook replied: ${reply}`;
  }).join("\n\n");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) startInkDiaryServer();
