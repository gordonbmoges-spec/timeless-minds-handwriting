import assert from "node:assert/strict";
import { test } from "node:test";

import { createCustomBookStore, normalizeBook } from "../public/modules/custom-books.js";

test("creates and reloads a bounded custom book", () => {
  const storage = memoryStorage();
  const store = createCustomBookStore(storage);
  const book = store.add({
    bookTitle: "月光炼金术笔记",
    name: "阿尔文教授",
    identity: "一位研究月相与金属变化的老教授。",
    personality: "谨慎、机智，先给结论，再用炼金术比喻。",
    openingLine: "你终于还是打开了这本书。",
    bookTone: "midnight",
    sigil: "月"
  }, () => "abc123def456");

  assert.equal(book.id, "custom-abc123def456");
  assert.equal(store.load()[0].personality, "谨慎、机智，先给结论，再用炼金术比喻。");
});

test("rejects incomplete or malformed custom books", () => {
  assert.equal(normalizeBook({ id: "custom-abc123", bookTitle: "空书" }), null);
  assert.equal(normalizeBook({ id: "../../bad", bookTitle: "书", name: "人", identity: "身份", personality: "性格" }), null);
});

test("removes only the selected custom book", () => {
  const storage = memoryStorage();
  const store = createCustomBookStore(storage);
  const first = store.add({
    bookTitle: "第一本书",
    name: "甲",
    identity: "第一位守书人",
    personality: "安静而敏锐"
  }, () => "first123456");
  const second = store.add({
    bookTitle: "第二本书",
    name: "乙",
    identity: "第二位守书人",
    personality: "温和而坚定"
  }, () => "second123456");

  const remaining = store.remove(first.id);

  assert.deepEqual(remaining.map((book) => book.id), [second.id]);
  assert.deepEqual(store.load().map((book) => book.id), [second.id]);
});

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}
