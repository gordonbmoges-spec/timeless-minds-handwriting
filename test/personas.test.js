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

test("keeps unannotated historical-persona rules while removing the selected restrictions", () => {
  const prompt = buildPersonaPrompt("confucius");
  assert.match(prompt, /你是孔子，来自春秋时期/);
  assert.match(prompt, /作品与译介传统：.*论语/);
  assert.match(prompt, /始终使用第一人称/);
  assert.match(prompt, /英文问题用英文回答.*中文问题用中文回答/);
  assert.match(prompt, /若用户问‘你是谁’/);
  assert.match(prompt, /按照人物口吻自然回答，可以自由发挥，不限制字数/);
  assert.doesNotMatch(prompt, /主要参考作品|时代边界|40至80|一至三句简短句子|只给出一段|Markdown|优先直接回答/);
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

test("applies the annotated changes to all nine default books", () => {
  for (const id of PERSONA_IDS) {
    const prompt = buildPersonaPrompt(id, {
      identity: `读者为${id}保存的当前身份`,
      personality: `读者为${id}保存的当前性格与口吻`,
      openingLine: "这句开场白只能在开书时显示"
    });
    assert.match(prompt, /作品与译介传统/);
    assert.match(prompt, /按照人物口吻自然回答，可以自由发挥，不限制字数/);
    assert.doesNotMatch(prompt, /这句开场白|当前开场白|本书默认档案|主要参考作品|时代边界|不把同人|不确定的细节|不得近似模仿在世作者|不得复现长段|优先回答用户|中文回复控制|一至三句|只给出一段|Markdown/);
  }
});

test("reader-edited identity and voice keep only the unannotated shared rules", () => {
  const prompt = buildPersonaPrompt("human-parchment", {
    identity: "《神秘复苏》大结局阶段的杨间，以杨间本人的身份回答。",
    personality: "冷静、直接，先回答事实，再说明风险。",
    openingLine: "我是杨间。你想知道哪件事？"
  });
  assert.match(prompt, /当前实际回答身份.*大结局阶段的杨间/);
  assert.match(prompt, /当前性格与回答口吻.*冷静、直接/);
  assert.match(prompt, /作品与译介传统/);
  assert.match(prompt, /始终使用第一人称/);
  assert.match(prompt, /英文问题用英文回答.*中文问题用中文回答/);
  assert.match(prompt, /保持原作世界观中已经确立的事实、关系和性格/);
  assert.match(prompt, /自由发挥，不限制字数/);
  assert.doesNotMatch(prompt, /当前开场白|本书默认档案|主要参考作品|时代边界|不把同人|不确定的细节|不得近似模仿在世作者|不得复现长段|优先回答用户|35至90|一至三句|Markdown/);
});

test("opening lines are never sent to the model", () => {
  const prompt = buildPersonaPrompt("human-parchment", {
    identity: "神秘复苏大结局阶段的杨间",
    personality: "冷静、警惕、克制",
    openingLine: ""
  });
  assert.doesNotMatch(prompt, /开场白|我叫杨间。当你看到这句话的时候/);
});

test("custom books keep unannotated identity and language rules without sending the opening line", () => {
  const prompt = buildCustomPersonaPrompt({
    name: "阿尔文教授",
    bookTitle: "月光炼金术笔记",
    identity: "研究月相与金属变化的老教授。",
    personality: "谨慎机智，喜欢用比喻。",
    openingLine: "你终于打开了这本书。"
  });
  assert.match(prompt, /书名：月光炼金术笔记/);
  assert.match(prompt, /人物：阿尔文教授/);
  assert.match(prompt, /身份背景：研究月相与金属变化的老教授/);
  assert.match(prompt, /性格与回答口吻：谨慎机智/);
  assert.match(prompt, /始终用第一人称直接回答，并跟随用户提问的主要语言/);
  assert.match(prompt, /按照人物口吻自然回答，可以自由发挥，不限制字数/);
  assert.doesNotMatch(prompt, /你终于打开了这本书|开场语|作品与译介传统|主要参考作品|时代边界|中文回复控制|受版权保护|模仿在世作者|Markdown/);
});
