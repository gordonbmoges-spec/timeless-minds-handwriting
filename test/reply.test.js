import assert from "node:assert/strict";
import { test } from "node:test";

import { createInkDiaryServer } from "../server.js";

const imageDataUrl = "data:image/png;base64,iVBORw0KGgo=";

async function withServer(options, run) {
  const server = createInkDiaryServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("rejects an unregistered persona id", async () => {
  await withServer({ env: {} }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "plato" })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_persona" });
  });
});

test("returns a persona-specific demo reply without an API key", async () => {
  await withServer({ env: {} }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "confucius" })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.mode, "demo");
    assert.equal(data.personaId, "confucius");
    assert.match(data.reply, /学|问|行/);
  });
});

test("selects the server-side persona prompt for an AI request", async () => {
  let upstreamBody;
  const fetchImpl = async (_url, init) => {
    upstreamBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({ transcript: "我该如何面对犹豫？", reply: "先辨明你所称的犹豫，究竟是无知，还是惧怕选择之后的责任。" })
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await withServer({
    env: { AI_API_KEY: "test-key", AI_BASE_URL: "https://example.com/v1", AI_MODEL: "vision-test" },
    fetchImpl
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "socrates", history: [] })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.mode, "ai");
    assert.equal(data.personaId, "socrates");
    const systemPrompt = upstreamBody.messages.find((message) => message.role === "system").content;
    assert.match(systemPrompt, /苏格拉底/);
    assert.doesNotMatch(JSON.stringify(upstreamBody), /test-key/);
  });
});

test("adds a bounded reply preference without replacing server rules", async () => {
  let upstreamBody;
  const fetchImpl = async (_url, init) => {
    upstreamBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ transcript: "你是谁？", reply: "我是孔丘，鲁国人，愿与你谈修身、学习和人与人相处之道。" }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        personaId: "confucius",
        personaInstruction: `  先直接回答。\n${"不要引用经典。".repeat(80)}`
      })
    });
    assert.equal(response.status, 200);
    const systemPrompt = upstreamBody.messages.find((message) => message.role === "system").content;
    assert.match(systemPrompt, /孔子/);
    assert.match(systemPrompt, /不得编造/);
    assert.match(systemPrompt, /用户的回复偏好/);
    assert.match(systemPrompt, /先直接回答/);
    assert.ok(systemPrompt.length < 1_400);
  });
});

test("asks for another sample when handwriting cannot be read", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ transcript: "", reply: "" }) } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "jung" })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.status, "needs_clarification");
    assert.equal(data.transcript, "");
    assert.ok(data.reply.length > 0);
  });
});
