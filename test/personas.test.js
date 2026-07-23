import assert from "node:assert/strict";
import { test } from "node:test";

import { PERSONA_IDS, buildCustomPersonaPrompt, buildPersonaPrompt, getPersona } from "../lib/personas.js";

test("registers the six thinkers and three story books", () => {
  assert.deepEqual(PERSONA_IDS, [
    "confucius",
    "socrates",
    "da-vinci",
    "shakespeare",
    "jung",
    "einstein",
    "magic-mirror",
    "tom-riddle",
    "human-parchment"
  ]);
});

test("returns no persona for an unregistered id", () => {
  assert.equal(getPersona("plato"), null);
  assert.equal(getPersona(""), null);
});

test("builds a minimal unconstrained fallback prompt", () => {
  const prompt = buildPersonaPrompt("confucius");
  assert.equal(prompt, [
    "人物设定：孔子",
    "请按照人物口吻自然回答，可以自由发挥，不限制字数。"
  ].join("\n"));
  assert.doesNotMatch(prompt, /作品|正史|同人|参考|译介|开场白|Markdown|字数控制|原作者/);
});

test("only Chinese-origin books fix their reply language to Chinese", () => {
  assert.equal(getPersona("confucius").replyLanguage, "zh");
  assert.equal(getPersona("human-parchment").replyLanguage, "zh");
  assert.equal(getPersona("socrates").replyLanguage, undefined);
  assert.equal(getPersona("tom-riddle").replyLanguage, undefined);
});

test("keeps all persona prompts visibly distinct", () => {
  const prompts = PERSONA_IDS.map((id) => buildPersonaPrompt(id));
  assert.equal(new Set(prompts).size, PERSONA_IDS.length);
});

test("reader-edited identity and voice are the complete answering profile", () => {
  const prompt = buildPersonaPrompt("human-parchment", {
    identity: "《神秘复苏》大结局阶段的杨间，以杨间本人的身份回答。",
    personality: "冷静、直接，先回答事实，再说明风险。",
    openingLine: "我是杨间。你想知道哪件事？"
  });
  assert.match(prompt, /^人物设定：《神秘复苏》大结局阶段的杨间/m);
  assert.match(prompt, /^性格与口吻：冷静、直接/m);
  assert.match(prompt, /自由发挥，不限制字数/);
  assert.doesNotMatch(prompt, /人皮纸|开场白|默认档案|作品|正史|现实预测|原作者/);
});

test("opening lines are never sent to the model", () => {
  const prompt = buildPersonaPrompt("human-parchment", {
    identity: "神秘复苏大结局阶段的杨间",
    personality: "冷静、警惕、克制",
    openingLine: ""
  });
  assert.doesNotMatch(prompt, /开场白|我叫杨间。当你看到这句话的时候/);
});

test("custom books send only reader-authored persona fields", () => {
  const prompt = buildCustomPersonaPrompt({
    name: "阿尔文教授",
    bookTitle: "月光炼金术笔记",
    identity: "研究月相与金属变化的老教授。",
    personality: "谨慎机智，喜欢用比喻。",
    openingLine: "你终于打开了这本书。"
  });
  assert.match(prompt, /人物名称：阿尔文教授/);
  assert.match(prompt, /人物设定：研究月相与金属变化的老教授/);
  assert.match(prompt, /性格与口吻：谨慎机智/);
  assert.doesNotMatch(prompt, /月光炼金术笔记|你终于打开了这本书|开场|作品|正史|字数控制/);
});
