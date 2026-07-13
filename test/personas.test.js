import assert from "node:assert/strict";
import { test } from "node:test";

import { PERSONA_IDS, buildPersonaPrompt, getPersona } from "../lib/personas.js";

test("registers exactly the six approved personas", () => {
  assert.deepEqual(PERSONA_IDS, [
    "confucius",
    "socrates",
    "da-vinci",
    "shakespeare",
    "jung",
    "einstein"
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
  assert.match(prompt, /现代汉语/);
  assert.match(prompt, /禁止文言文/);
  assert.match(prompt, /contemporary conversational English/);
  assert.match(prompt, /透明翻译/);
  assert.match(prompt, /表层语言属于用户/);
});

test("keeps Shakespeare modern even when preserving his imagery", () => {
  const prompt = buildPersonaPrompt("shakespeare");
  assert.match(prompt, /舞台.*角色.*幕布/);
  assert.match(prompt, /不使用 thou、thee/);
  assert.match(prompt, /never use archaic English/);
});

test("keeps all persona prompts visibly distinct", () => {
  const prompts = PERSONA_IDS.map((id) => buildPersonaPrompt(id));
  assert.equal(new Set(prompts).size, PERSONA_IDS.length);
});
