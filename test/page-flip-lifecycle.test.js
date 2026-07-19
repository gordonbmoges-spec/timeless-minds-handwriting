import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("keeps the flipbook root reusable when the same book opens again", () => {
  assert.match(appSource, /state\.pageFlip\.clear\(\);/);
  assert.match(appSource, /state\.pageFlip\.getUI\(\)\.destroy\(\);/);
  assert.doesNotMatch(appSource, /state\.pageFlip\.destroy\(\);/);
  assert.match(appSource, /function resetFlipbookMarkup\(\)/);
});
