import assert from "node:assert/strict";
import { test } from "node:test";

import { createHistoryStore } from "../public/modules/history-store.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("keeps history separate for each persona and newest first", () => {
  const store = createHistoryStore(memoryStorage());
  store.append("confucius", { transcript: "你是谁", reply: "我是孔丘。", at: "2026-07-12T10:00:00.000Z" });
  store.append("confucius", { transcript: "何为学习", reply: "学习也在践行。", at: "2026-07-12T10:01:00.000Z" });
  store.append("socrates", { transcript: "何为善", reply: "先说何为善。" });

  assert.deepEqual(store.load("confucius").map((turn) => turn.transcript), ["何为学习", "你是谁"]);
  assert.equal(store.load("socrates").length, 1);
});

test("limits each persona archive to twenty valid turns", () => {
  const store = createHistoryStore(memoryStorage());
  for (let index = 0; index < 25; index += 1) {
    store.append("confucius", { transcript: `问题${index}`, reply: `回答${index}` });
  }
  const turns = store.load("confucius");
  assert.equal(turns.length, 20);
  assert.equal(turns[0].transcript, "问题24");
  assert.equal(turns.at(-1).transcript, "问题5");
});

test("preserves long model replies without the old three-hundred-character cutoff", () => {
  const store = createHistoryStore(memoryStorage());
  const longReply = "这是一段完整的长回答。".repeat(80);
  store.append("tom-riddle", { transcript: "请详细回答", reply: longReply });
  assert.equal(store.load("tom-riddle")[0].reply, longReply);
});

test("clears one persona and recovers from invalid storage", () => {
  const storage = memoryStorage({ "minds-archive-history-v1-confucius": "not-json" });
  const store = createHistoryStore(storage);
  assert.deepEqual(store.load("confucius"), []);
  store.append("confucius", { transcript: "问题", reply: "回答" });
  store.clear("confucius");
  assert.deepEqual(store.load("confucius"), []);
});
