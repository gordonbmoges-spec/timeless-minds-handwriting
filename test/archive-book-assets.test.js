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

test("ships photorealistic generated inner pages", async () => {
  for (const filename of ["arcane-inscription.webp", "blank-vellum.webp"]) {
    const url = new URL(`../public/assets/magic/pages/${filename}`, import.meta.url);
    await access(url);
    assert.ok((await stat(url)).size > 300_000, `${filename} should preserve detailed parchment texture`);
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

test("keeps the selected cover alive through the shelf-to-page handoff", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /function createBookTransitionPortal\(/);
  assert.match(app, /hasBookPortal \? 2_050 : 1_720/);
  assert.match(app, /elements\.sceneView\.classList\.toggle\("is-handoff-opening", hasBookHandoff\)/);
  assert.match(css, /@keyframes bookPortalTravel/);
  assert.match(css, /@keyframes handoffBookStage/);
  assert.match(css, /\.persona-list \.shelf-upper\s*\{\s*right:24%;left:27%;/);
  assert.match(css, /\.persona-list \.shelf-lower\s*\{\s*right:24%;left:50%;/);
});

test("crossfades the opening cover and returns it to the same shelf slot", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(app, /function createBookReturnPortal\(/);
  assert.match(app, /function finishBookReturnToShelf\(/);
  assert.match(app, /target\.classList\.add\("is-return-target"\)/);
  assert.doesNotMatch(css, /portalThicknessIn/);
  assert.match(css, /filter:blur\(1\.1px\) brightness\(\.9\)/);
  assert.match(css, /0%,3% \{ opacity:0;filter:blur\(1\.1px\) brightness\(\.9\)/);
  assert.match(css, /\.opening-flip-cover\.stf__item\.--hard\s*\{[^}]*background:transparent!important;/s);
  assert.doesNotMatch(css, /var\(--opening-cover-image\)[^;}]*#120b07/s);
  assert.match(css, /\.opening-flip-paper\.stf__item\s*\{[^}]*background:transparent;/s);
  assert.doesNotMatch(css, /@keyframes openingPagesReveal/);
  assert.match(css, /\.opening-flip-paper \.pageflip-parchment-face\s*\{[^}]*inset:2\.8% 6\.2% 3\.2% 4\.8%;/s);
  assert.match(css, /\.opening-flip-paper\.--left \.pageflip-parchment-face\s*\{[^}]*inset:2\.8% -\.35% 3\.2% 4\.8%;[^}]*clip-path:polygon\([^)]*100% 0,100% 100%/s);
  assert.match(css, /\.opening-flip-paper\.--right \.pageflip-parchment-face\s*\{[^}]*inset:2\.8% 6\.2% 3\.2% -\.35%;[^}]*clip-path:polygon\(0 0,[^)]*0 100%\)/s);
  assert.match(css, /arcane-inscription\.webp/);
  assert.match(css, /blank-vellum\.webp/);
  assert.match(html, /pageflip-blank-face[\s\S]*pageflip-arcane-face[\s\S]*pageflip-blank-face/);
  assert.match(app, /pageFlip\.flipNext\("bottom"\), 2_720/);
  assert.match(css, /@keyframes returnClosedBook/);
  assert.match(css, /@keyframes bookPortalReturn/);
});

test("reconstructs the reference opening with a fixed cover and sequential code-rendered leaves", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.equal((html.match(/hinge-turning-leaf hinge-leaf-/g) || []).length, 5);
  assert.match(html, /B · 参考视频代码版/);
  assert.match(app, /return \["crisp", "hinge", "legacy"\]\.includes\(saved\) \? saved : "hinge"/);
  assert.match(app, /state\.motionMode === "hinge" \? 5_850 : 4_350/);
  assert.match(css, /@keyframes referenceCoverOpen/);
  assert.match(css, /@keyframes referenceLeafTurn/);
  assert.match(css, /\.hinge-leaf-5[^\n]*--leaf-z:2px/);
});
