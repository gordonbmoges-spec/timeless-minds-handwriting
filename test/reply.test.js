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

test("honestly reports that demo mode cannot detect handwriting language", async () => {
  await withServer({ env: {} }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "confucius" })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.mode, "demo");
    assert.equal(data.status, "demo_unavailable");
    assert.equal(data.personaId, "confucius");
    assert.equal(data.transcript, "");
    assert.match(data.reply, /不能识别手写内容/);
    assert.match(data.reply, /cannot read handwriting/i);
    assert.deepEqual(data.diagnostics, {
      mode: "demo",
      model: "",
      source: "none",
      personaId: "confucius",
      profileApplied: false,
      profileFieldsApplied: {
        identity: false,
        personality: false,
        openingLine: false
      },
      memoryApplied: false,
      historyTurns: 0
    });
  });
});

test("reports a server AI connection without exposing its key", async () => {
  await withServer({ env: { AI_API_KEY: "test-key", AI_MODEL: "vision-test" } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/status`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data, { mode: "ai", model: "vision-test", source: "server" });
    assert.doesNotMatch(JSON.stringify(data), /test-key/);
  });
});

test("returns the model reply as-is without a language repair request", async () => {
  const upstreamBodies = [];
  const fetchImpl = async (_url, init) => {
    upstreamBodies.push(JSON.parse(init.body));
    const content = { transcript: "What makes a life worth living?", reply: "先问清楚，你所说的值得究竟是什么。" };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "socrates" })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.transcript, "What makes a life worth living?");
    assert.equal(data.reply, "先问清楚，你所说的值得究竟是什么。");
    assert.equal(upstreamBodies.length, 1);
  });
});

test("does not make a second request when an English reply already matches", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ transcript: "Who are you?", reply: "I am Socrates of Athens. Tell me which belief you wish to examine." }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "socrates" })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.match(data.reply, /^I am Socrates/);
    assert.equal(callCount, 1);
  });
});

test("does not truncate a long model reply", async () => {
  const longReply = "我是汤姆，这一页会把你写下的秘密完整保留下来。".repeat(40);
  const fetchImpl = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ transcript: "详细说说", reply: longReply }) } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "tom-riddle" })
    });
    const data = await response.json();
    assert.equal(data.reply, longReply);
  });
});

test("does not force a configured persona into a fixed reply language", async () => {
  const upstreamBodies = [];
  const fetchImpl = async (_url, init) => {
    upstreamBodies.push(JSON.parse(init.body));
    const content = { transcript: "How should I treat my friends?", reply: "Treat them with sincerity, and examine your own conduct first." };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "confucius" })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.transcript, "How should I treat my friends?");
    assert.equal(data.reply, "Treat them with sincerity, and examine your own conduct first.");
    assert.equal(upstreamBodies.length, 1);
    assert.doesNotMatch(upstreamBodies[0].messages[1].content[0].text, /Chinese persona|same primary language/);
  });
});

test("sends only the editable persona fields plus technical JSON instructions", async () => {
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
      body: JSON.stringify({
        imageDataUrl,
        personaId: "socrates",
        personaProfile: {
          identity: "古典雅典的哲学家苏格拉底。",
          personality: "坦率、温和而尖锐，喜欢通过连续追问检验观点。"
        },
        history: []
      })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.mode, "ai");
    assert.equal(data.personaId, "socrates");
    const systemPrompt = upstreamBody.messages.find((message) => message.role === "system").content;
    const userPrompt = upstreamBody.messages.find((message) => message.role === "user").content[0].text;
    assert.match(systemPrompt, /人物设定：古典雅典的哲学家苏格拉底/);
    assert.match(systemPrompt, /性格与口吻：坦率、温和而尖锐/);
    assert.match(systemPrompt, /自由发挥，不限制字数/);
    assert.match(userPrompt, /识别图片中的手写文字/);
    assert.doesNotMatch(systemPrompt, /作品与译介传统|主要参考作品|时代边界|正史|开场白|原作者|回复长度/);
    assert.doesNotMatch(userPrompt, /source-work|translator|primary language|Long-term memory|Recent conversation/);
    assert.equal("max_tokens" in upstreamBody, false);
    assert.doesNotMatch(JSON.stringify(upstreamBody), /test-key/);
  });
});

test("adds a bounded reader-authored reply preference without hidden constraints", async () => {
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
    assert.match(systemPrompt, /补充回复偏好/);
    assert.match(systemPrompt, /先直接回答/);
    assert.doesNotMatch(systemPrompt, /不能覆盖|语言匹配|作品与译介传统|不得编造|回复长度/);
    assert.ok(systemPrompt.length < 1_800);
  });
});

test("uses the edited default-book profile and never sends its opening line", async () => {
  let upstreamBody;
  const fetchImpl = async (_url, init) => {
    upstreamBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ transcript: "你怎么看？", reply: "先把问题分成可以检验的部分。" }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        personaId: "einstein",
        personaProfile: {
          identity: `专注于日常产品设计。${"身份".repeat(300)}`,
          personality: "先给结论，再做一个简短思想实验。",
          openingLine: "我是现在的爱因斯坦。先写下你的问题。"
        }
      })
    });
    assert.equal(response.status, 200);
    const systemPrompt = upstreamBody.messages.find((message) => message.role === "system").content;
    assert.match(systemPrompt, /人物设定：专注于日常产品设计/);
    assert.match(systemPrompt, /先给结论，再做一个简短思想实验/);
    assert.doesNotMatch(systemPrompt, /我是现在的爱因斯坦|开场白|阿尔伯特·爱因斯坦|默认档案|作品事实|不得编造/);
    assert.ok(systemPrompt.length < 2_800);
    const data = await response.json();
    assert.equal(data.diagnostics.profileApplied, true);
    assert.deepEqual(data.diagnostics.profileFieldsApplied, {
      identity: true,
      personality: true,
      openingLine: false
    });
    assert.equal(data.diagnostics.mode, "ai");
    assert.equal(data.diagnostics.source, "server");
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

test("custom books send persona, memory and history but never send the opening line", async () => {
  let upstreamBody;
  const fetchImpl = async (_url, init) => {
    upstreamBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ transcript: "你还记得我吗？", reply: "当然，小腾。你仍在完善那本会回应人的书。" }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await withServer({ env: { AI_API_KEY: "test-key" }, fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        personaId: "custom-abc123def456",
        personaMemory: "读者叫小腾，正在制作一本会回应人的书。",
        history: [{ transcript: "上次我们谈了什么？", reply: "谈了会回应人的书。" }],
        customPersona: {
          name: "阿尔文教授",
          bookTitle: "月光炼金术笔记",
          identity: "研究月相与金属变化的老教授。",
          personality: "谨慎机智，先给结论再作比喻。",
          openingLine: "你终于打开了这本书。"
        }
      })
    });
    assert.equal(response.status, 200);
    const systemPrompt = upstreamBody.messages.find((message) => message.role === "system").content;
    const userPrompt = upstreamBody.messages.find((message) => message.role === "user").content[0].text;
    assert.match(systemPrompt, /阿尔文教授/);
    assert.match(systemPrompt, /人物设定：研究月相与金属变化的老教授/);
    assert.match(systemPrompt, /长期记忆：读者叫小腾/);
    assert.match(systemPrompt, /最近对话历史/);
    assert.match(systemPrompt, /上次我们谈了什么/);
    assert.doesNotMatch(systemPrompt, /你终于打开了这本书|月光炼金术笔记|开场/);
    assert.doesNotMatch(userPrompt, /读者叫小腾|上次我们谈了什么/);
  });
});

test("rejects a custom persona without complete bounded profile data", async () => {
  await withServer({ env: {} }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, personaId: "custom-abc123", customPersona: { name: "空白" } })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_persona" });
  });
});
