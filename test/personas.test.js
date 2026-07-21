import assert from "node:assert/strict";
import { test } from "node:test";

import { PERSONA_IDS, buildPersonaPrompt, getPersona } from "../lib/personas.js";

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

test("builds a first-person, era-analogy, short-reply prompt", () => {
  const prompt = buildPersonaPrompt("confucius");
  assert.match(prompt, /孔子/);
  assert.match(prompt, /第一人称/);
  assert.match(prompt, /时代类比/);
  assert.match(prompt, /40.*80/);
  assert.match(prompt, /不得编造/);
  assert.match(prompt, /优先直接回答/);
  assert.match(prompt, /你是谁/);
  assert.match(prompt, /简短.*自我介绍/);
  assert.match(prompt, /不要.*堆砌.*经典/);
  assert.match(prompt, /英文问题用英文回答.*中文问题用中文回答/);
  assert.match(prompt, /半文半白.*浅近文言/);
  assert.match(prompt, /外国人物.*中文译本/);
  assert.match(prompt, /原作、公共领域译本、通行译介传统/);
  assert.match(prompt, /不照搬.*现代译者/);
  assert.match(prompt, /透明翻译/);
  assert.match(prompt, /表层语言属于用户/);
  assert.match(prompt, /作品与译介传统：.*论语/);
  assert.match(prompt, /主要参考作品：.*论语/);
  assert.match(prompt, /回复语言规则：.*始终.*中文/);
});

test("only Chinese-origin books fix their reply language to Chinese", () => {
  assert.equal(getPersona("confucius").replyLanguage, "zh");
  assert.equal(getPersona("human-parchment").replyLanguage, "zh");
  assert.equal(getPersona("socrates").replyLanguage, undefined);
  assert.equal(getPersona("tom-riddle").replyLanguage, undefined);
});

test("keeps Shakespeare recognizable through original and translated traditions", () => {
  const prompt = buildPersonaPrompt("shakespeare");
  assert.match(prompt, /舞台.*角色.*幕布/);
  assert.match(prompt, /不堆砌 thou、thee/);
  assert.match(prompt, /成熟.*戏剧翻译传统/);
});

test("keeps all persona prompts visibly distinct", () => {
  const prompts = PERSONA_IDS.map((id) => buildPersonaPrompt(id));
  assert.equal(new Set(prompts).size, PERSONA_IDS.length);
});

test("story books keep recognizable character boundaries", () => {
  assert.match(buildPersonaPrompt("magic-mirror"), /当然是你呀，皇后/);
  assert.match(buildPersonaPrompt("tom-riddle"), /汤姆·里德尔.*日记/s);
  assert.match(buildPersonaPrompt("tom-riddle"), /不照抄小说对白.*不模仿原作者文风/);
  assert.match(buildPersonaPrompt("human-parchment"), /未来完成时/);
  assert.match(buildPersonaPrompt("human-parchment"), /虚构预言.*现实预测/);
});
