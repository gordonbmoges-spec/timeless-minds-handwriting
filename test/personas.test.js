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
});

test("keeps all persona prompts visibly distinct", () => {
  const prompts = PERSONA_IDS.map((id) => buildPersonaPrompt(id));
  assert.equal(new Set(prompts).size, PERSONA_IDS.length);
});
