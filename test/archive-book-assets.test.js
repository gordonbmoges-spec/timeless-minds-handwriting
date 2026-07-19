import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const bookIds = [
  "confucius",
  "socrates",
  "da-vinci",
  "shakespeare",
  "jung",
  "einstein",
  "tom-riddle",
  "human-parchment"
];

test("ships one independently generated physical book asset for every shelf book", async () => {
  for (const id of bookIds) {
    const url = new URL(`../public/assets/magic/books/${id}.webp`, import.meta.url);
    await access(url);
    const file = await stat(url);
    assert.ok(file.size > 100_000, `${id} should use a detailed generated book asset`);
  }
});

test("keeps the shelf click layer in physical front-to-back order", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.book-shelf-row\s*\{[^}]*pointer-events:none;/s);
  assert.match(css, /\.generated-book-card:nth-child\(8\)\s*\{[^}]*--shelf-order:8;/s);
  assert.match(css, /\.generated-book-card\.is-opening\s*\{\s*z-index:40;/);
  assert.match(css, /@keyframes generatedBookEdgeTrace/);
});
