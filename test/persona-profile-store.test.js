import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPersonaProfile,
  createPersonaProfileStore,
  normalizePersonaProfile
} from "../public/modules/persona-profile-store.js";

test("stores a separate editable profile for every default or custom book", () => {
  const store = createPersonaProfileStore(memoryStorage());
  assert.equal(store.save("confucius", { identity: "新的身份背景", personality: "更直接的口吻" }), true);
  assert.equal(store.save("custom-abc123", { identity: "自定义身份", personality: "自定义性格" }), true);
  assert.deepEqual(store.load("confucius"), { identity: "新的身份背景", personality: "更直接的口吻" });
  assert.deepEqual(store.load("custom-abc123"), { identity: "自定义身份", personality: "自定义性格" });
});

test("applies an override without mutating the original persona", () => {
  const original = { id: "jung", identity: "原始身份", personality: "原始性格" };
  const effective = applyPersonaProfile(original, { identity: "修改身份", personality: "修改性格" });
  assert.deepEqual(original, { id: "jung", identity: "原始身份", personality: "原始性格" });
  assert.equal(effective.identity, "修改身份");
  assert.equal(effective.personality, "修改性格");
  assert.equal(effective.hasProfileOverride, true);
});

test("bounds and normalizes reader-edited profile text", () => {
  const profile = normalizePersonaProfile({
    identity: `  第一行\n${"身".repeat(700)}`,
    personality: "  冷静\t直接  "
  });
  assert.equal(profile.identity.length, 500);
  assert.equal(profile.personality, "冷静 直接");
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
