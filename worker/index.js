import { buildCustomPersonaPrompt, buildPersonaPrompt, getPersona } from "./personas.js";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-68ovwuVEgP4KP6803CNhdg6S0jCfEydjM4sM/Qdnc5o='; script-src 'self'; connect-src 'self'; worker-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
});

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === "/api/reply") {
        return handleReply(request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        return json(publicAiStatus(resolveApiConfig({}, env)));
      }

      if (request.method === "GET" || request.method === "HEAD") {
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404 || url.pathname.includes(".")) return secureResponse(response);
        const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url), request));
        return secureResponse(shell);
      }

      return json({ error: "method_not_allowed" }, 405);
    } catch (error) {
      console.error("Ink Diary worker error", error?.message || "unknown");
      return json({ error: "server_error", message: "纸页暂时安静了，请稍后重试。" }, 500);
    }
  },
};

async function handleReply(request, env) {
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) {
    return json({ error: "request_too_large" }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const imageDataUrl = String(payload.imageDataUrl || "");
  if (!imageDataUrl.startsWith("data:image/png;base64,")) {
    return json({ error: "missing_png" }, 400);
  }

  const registeredPersona = getPersona(payload.personaId);
  const customPersona = normalizeCustomPersona(payload.personaId, payload.customPersona);
  const persona = registeredPersona || customPersona;
  if (!persona) return json({ error: "invalid_persona" }, 400);

  const style = normalizeStyle(payload.style);
  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const personaInstruction = cleanText(payload.personaInstruction || "", 300);
  const personaMemory = cleanText(payload.personaMemory || "", 600);
  const personaProfile = registeredPersona ? normalizePersonaProfile(payload.personaProfile) : null;
  const apiConfig = resolveApiConfig(payload.apiConfig, env);
  const diagnostics = replyDiagnostics({ apiConfig, persona, personaProfile, personaMemory, history });

  if (!apiConfig.key) return json(demoReply(persona, style, diagnostics));

  const readingPrompt = [
    "识别图片中的手写文字，并结合系统消息中的人物设定、长期记忆和最近对话作答。",
    "只返回 JSON 对象，包含 transcript 和 reply 两个字符串字段。",
    "transcript 是识别到的手写原文；无法识别时为空字符串。",
    "reply 是人物的回答；无法识别时为空字符串。",
  ].filter(Boolean).join("\n\n");

  const personaSystemPrompt = [
    registeredPersona ? buildPersonaPrompt(persona.id, personaProfile) : buildCustomPersonaPrompt(persona),
    personaInstruction ? `补充回复偏好：${personaInstruction}` : "",
    personaMemory ? `长期记忆：${personaMemory}` : "",
    history.length ? `最近对话历史：\n${formatHistory(history)}` : "",
    "只返回包含 transcript 和 reply 的 JSON 对象。",
  ].filter(Boolean).join("\n");

  const apiResponse = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiConfig.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: apiConfig.model,
      temperature: 0.72,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: personaSystemPrompt,
        },
        {
          role: "user",
          content: [
            { type: "text", text: readingPrompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  const raw = await apiResponse.text();
  if (!apiResponse.ok) {
    console.error("AI request failed", { status: apiResponse.status, personaId: persona.id });
    return json({
      error: "ai_request_failed",
      message: "模型服务拒绝了请求，请检查 Key、模型和接口地址。",
    }, apiResponse.status);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_ai_response" }, 502);
  }

  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(content);
  const transcript = cleanText(parsed.transcript || "", 900);

  if (!transcript) {
    return json({
      mode: "ai",
      status: "needs_clarification",
      personaId: persona.id,
      transcript: "",
      reply: persona.clarificationReply,
      style,
      diagnostics,
    });
  }

  const reply = cleanReply(parsed.reply || persona.clarificationReply);

  return json({
    mode: "ai",
    status: "ok",
    personaId: persona.id,
    transcript,
    reply,
    style,
    diagnostics,
  });
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store" }
  });
}

function secureResponse(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
      source: "session",
    };
  }

  return {
    key: env.AI_API_KEY || env.OPENAI_API_KEY || env.DASHSCOPE_API_KEY || env.RIDDLE_OPENAI_KEY || "",
    baseUrl: String(env.AI_BASE_URL || env.OPENAI_BASE_URL || env.DASHSCOPE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: env.AI_MODEL || env.OPENAI_MODEL || "qwen3-vl-plus",
    source: "server",
  };
}

function cleanConfigValue(value, maxLength) {
  return String(value || "").replace(/[\r\n]/g, "").trim().slice(0, maxLength);
}

function isAllowedApiUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.protocol !== "https:") return false;
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

function normalizeStyle(style = {}) {
  return {
    inkWidth: clamp(Number(style.inkWidth) || 3, 1, 12),
    slant: clamp(Number(style.slant) || 0, -0.35, 0.35),
    letterSize: clamp(Number(style.letterSize) || 42, 26, 68),
    pace: clamp(Number(style.pace) || 1, 0.65, 1.6),
  };
}

function demoReply(persona, style, diagnostics) {
  return {
    mode: "demo",
    status: "demo_unavailable",
    personaId: persona.id,
    transcript: "",
    reply: "演示模式不能识别手写内容，也无法判断你写的是中文还是英文。请先配置视觉模型。 Demo mode cannot read handwriting or detect its language. Configure a vision model first.",
    style,
    diagnostics,
  };
}

function publicAiStatus(apiConfig) {
  return {
    mode: apiConfig.key ? "ai" : "demo",
    model: apiConfig.key ? apiConfig.model : "",
    source: apiConfig.key ? apiConfig.source : "none",
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
      openingLine: false,
    },
    memoryApplied: Boolean(personaMemory),
    historyTurns: history.length,
  };
}

function formatHistory(history) {
  return history.map((turn) => {
    const user = cleanText(turn.transcript || "", 300);
    const reply = cleanReply(turn.reply || "");
    return `User wrote: ${user}\nNotebook replied: ${reply}`;
  }).join("\n\n");
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
    personality: cleanText(value.personality || "", 260),
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
