import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3107);
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "POST" && url.pathname === "/api/reply") {
      await handleReply(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(url.pathname, res, req.method === "HEAD");
      return;
    }

    sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "server_error", message: "The diary went quiet." });
  }
});

let selectedPort = PORT;
server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && selectedPort < PORT + 20) {
    selectedPort += 1;
    console.log(`Port ${selectedPort - 1} is busy, trying ${selectedPort}...`);
    setTimeout(() => server.listen(selectedPort), 80);
    return;
  }
  throw error;
});

server.on("listening", () => {
  console.log(`Ink Diary MVP running at http://localhost:${selectedPort}`);
});

server.listen(selectedPort);

async function handleReply(req, res) {
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

  const style = normalizeStyle(payload.style);
  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const apiConfig = resolveApiConfig(payload.apiConfig);
  const { key, baseUrl, model } = apiConfig;

  if (!key) {
    sendJson(res, 200, demoReply(style));
    return;
  }

  const prompt = [
    "Read the handwriting in the image and answer as a quiet handwritten notebook.",
    "Return strict JSON only with these keys:",
    "transcript: the words the user wrote, best effort.",
    "reply: a short response in the same language as the user, one to three sentences.",
    "Do not mention AI, images, screenshots, OCR, models, or prompts.",
    "Do not use any copyrighted character name or franchise persona.",
    history.length ? `Recent conversation:\n${formatHistory(history)}` : ""
  ].filter(Boolean).join("\n\n");

  const apiRes = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.75,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are the voice of a private handwriting notebook. You read ink and write back concisely."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } }
          ]
        }
      ]
    })
  });

  const raw = await apiRes.text();
  if (!apiRes.ok) {
    console.error(raw);
    sendJson(res, apiRes.status, {
      error: "ai_request_failed",
      message: "The AI service rejected the request. Check your key, model, and base URL."
    });
    return;
  }

  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(content);
  sendJson(res, 200, {
    mode: "ai",
    transcript: cleanText(parsed.transcript || ""),
    reply: cleanText(parsed.reply || "我读见了你的墨迹，只是这页还没有完全醒来。"),
    style
  });
}

async function serveStatic(pathname, res, headOnly) {
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
      "Content-Type": mimeType(requested),
      "Cache-Control": shouldRevalidate ? "no-store" : "public, max-age=3600"
    });
    if (!headOnly) res.end(file);
    else res.end();
  } catch {
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
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
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

function cleanText(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, 900);
}

function normalizeStyle(style = {}) {
  return {
    inkWidth: clamp(Number(style.inkWidth) || 3, 1, 12),
    slant: clamp(Number(style.slant) || 0, -0.35, 0.35),
    letterSize: clamp(Number(style.letterSize) || 42, 26, 68),
    pace: clamp(Number(style.pace) || 1, 0.65, 1.6)
  };
}

function resolveApiConfig(clientConfig = {}) {
  const clientKey = cleanConfigValue(clientConfig.apiKey, 512);
  const clientBaseUrl = cleanConfigValue(clientConfig.baseUrl, 1000);
  const clientModel = cleanConfigValue(clientConfig.model, 200);

  if (clientKey && clientBaseUrl && clientModel && isAllowedApiUrl(clientBaseUrl)) {
    return {
      key: clientKey,
      baseUrl: clientBaseUrl.replace(/\/+$/, ""),
      model: clientModel
    };
  }

  return {
    key: process.env.AI_API_KEY
      || process.env.OPENAI_API_KEY
      || process.env.DASHSCOPE_API_KEY
      || process.env.RIDDLE_OPENAI_KEY,
    baseUrl: (process.env.AI_BASE_URL
      || process.env.OPENAI_BASE_URL
      || process.env.DASHSCOPE_BASE_URL
      || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || "qwen3-vl-plus"
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

function demoReply(style) {
  return {
    mode: "demo",
    transcript: "演示模式：未配置 API Key，暂不识别真实手写内容。",
    reply: "我已经学到你这页墨迹的粗细、倾斜和节奏。接上视觉模型后，我就能读懂你写的话，再用接近你笔触的方式回信。",
    style
  };
}

function formatHistory(history) {
  return history.map((turn, index) => {
    const user = cleanText(turn.transcript || "");
    const reply = cleanText(turn.reply || "");
    return `${index + 1}. User: ${user}\nNotebook: ${reply}`;
  }).join("\n");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
