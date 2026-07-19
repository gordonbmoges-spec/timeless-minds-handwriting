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

test("ships one straight-on cover for every shelf and opening sequence", async () => {
  for (const id of bookIds) {
    const url = new URL(`../public/assets/magic/covers/${id}.webp`, import.meta.url);
    await access(url);
    const file = await stat(url);
    assert.ok(file.size > 200_000, `${id} should use a detailed flat cover asset`);
  }
});

test("uses a quiet two-row flat-cover gallery and the same cover while opening", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.persona-list \.shelf-upper\s*\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\);/s);
  assert.match(css, /\.persona-list \.shelf-lower\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/s);
  assert.match(css, /\.mirror-card:hover::before,\.mirror-card:focus-visible::before\s*\{[^}]*box-shadow:none;/s);
  assert.match(css, /\.scene-view\.has-generated-cover \.pageflip-cover-face:not\(\.pageflip-back-cover\)[^{]*\{[^}]*var\(--opening-cover-image\)/s);
  assert.match(css, /@keyframes realBookArrive/);
});

test("ships a boundaryless panoramic parchment and removes writing-scene labels", async () => {
  const parchment = new URL("../public/assets/magic/panoramic-parchment.webp", import.meta.url);
  await access(parchment);
  assert.ok((await stat(parchment)).size > 200_000);

  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(css, /\.scene-view:not\(\.scene-mirror\) \.paper-object\s*\{[^}]*panoramic-parchment\.webp/s);
  assert.match(css, /\.scene-view:not\(\.scene-mirror\) \.writing-heading\s*\{\s*display:none;/);
  assert.match(css, /\.scene-view:not\(\.scene-mirror\) \.book-edge\s*\{\s*display:none;/);
  assert.match(app, /elements\.activeBookTitle\.textContent = persona\.name;/);
  assert.match(app, /elements\.openingBookTitle\.textContent = persona\.name;/);
});
