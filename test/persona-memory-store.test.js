import assert from "node:assert/strict";
import test from "node:test";
import { createPersonaMemoryStore } from "../public/modules/persona-memory-store.js";

test("keeps long-term memory separate for every built-in and custom book", () => {
  const storage = memoryStorage();
  const store = createPersonaMemoryStore(storage);
  assert.equal(store.save("confucius", "我正在研究《论语》。"), true);
  assert.equal(store.save("tom-riddle", "不要相信这本日记。"), true);
  assert.equal(store.save("custom-abc123", "这是自定义书的独立记忆。"), true);
  assert.equal(store.load("confucius"), "我正在研究《论语》。");
  assert.equal(store.load("tom-riddle"), "不要相信这本日记。");
  assert.equal(store.load("custom-abc123"), "这是自定义书的独立记忆。");
});

test("clearing one book does not erase another book's long-term memory", () => {
  const store = createPersonaMemoryStore(memoryStorage());
  store.save("jung", "继续讨论梦。 ");
  store.save("einstein", "继续讨论时间。 ");
  assert.equal(store.clear("jung"), true);
  assert.equal(store.load("jung"), "");
  assert.equal(store.load("einstein"), "继续讨论时间。");
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
