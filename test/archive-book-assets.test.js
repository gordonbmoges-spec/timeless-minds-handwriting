import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";
import { PERSONAS } from "../public/data/personas.js";

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
  assert.match(app, /async function waitForPortalPaint\(portal\)/);
  assert.match(app, /await Promise\.allSettled\(images\.map/);
  assert.match(app, /await nextAnimationFrame\(\);\s*await nextAnimationFrame\(\);/s);
  assert.match(app, /portal\.classList\.remove\("is-priming"\);\s*portal\.classList\.add\("is-ready"\);\s*await nextAnimationFrame\(\);\s*button\.classList\.add\("is-portal-source"\)/s);
  assert.match(app, /hasBookPortal \? SHELF_TRAVEL_MS : 1_520/);
  assert.match(app, /elements\.sceneView\.classList\.toggle\("is-handoff-opening", hasBookHandoff\)/);
  assert.match(app, /BOOK_HANDOFF_FADE_DELAY_MS = 320/);
  assert.match(app, /BOOK_HANDOFF_REMOVE_MS = 1_120/);
  assert.match(app, /setTimeout\(clearBookTransitionPortal, BOOK_HANDOFF_REMOVE_MS\)/);
  assert.match(css, /@keyframes bookPortalTravel/);
  assert.match(css, /@keyframes handoffBookStage/);
  assert.match(css, /\.book-transition-portal\.is-priming\s*\{[^}]*opacity:\.001;[^}]*transition:none;/s);
  assert.match(css, /\.persona-list \.shelf-upper\s*\{\s*right:24%;left:27%;/);
  assert.match(css, /\.persona-list \.shelf-lower\s*\{\s*right:24%;left:50%;/);
});

test("locks reply fonts before canvas animation and reveals the archive title in sequence", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(app, /document\.fonts\.load\(descriptor, sample\)/);
  assert.match(app, /document\.fonts\.check\(descriptor, sample\)/);
  assert.match(app, /await resolveReplyFont\(text, fontSize\)/);
  assert.match(app, /return '\"Dancing Script\", cursive'/);
  assert.match(html, /class="archive-view is-entering"/);
  assert.match(css, /@keyframes archiveMagicTextReveal/);
  assert.match(css, /@keyframes archiveTitleTextReveal/);
  assert.match(css, /archiveMagicTextReveal 1\.7s \.18s/);
  assert.match(css, /archiveTitleTextReveal 2s \.62s/);
});

test("crossfades the opening cover and returns it to the same shelf slot", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(app, /async function createBookReturnPortal\(/);
  assert.match(app, /portal\.className = "book-transition-portal book-return-portal is-priming"/);
  assert.match(app, /await waitForPortalPaint\(portal\);/);
  assert.match(app, /portal\.classList\.add\("is-ready"\);\s*portal\.classList\.remove\("is-priming"\);\s*await nextAnimationFrame\(\);\s*await nextAnimationFrame\(\);/s);
  assert.match(app, /!await createBookReturnPortal\(state\.persona\)/);
  assert.match(app, /function finishBookReturnToShelf\(/);
  assert.match(app, /target\.classList\.add\("is-return-target"\)/);
  assert.match(app, /BOOK_RETURN_TRAVEL_MS = 1_650/);
  assert.match(app, /elements\.personaList\.classList\.remove\("is-returning-book"\);\s*target\.classList\.remove\("is-return-target"\);\s*await nextAnimationFrame\(\);\s*await nextAnimationFrame\(\);[\s\S]*portal\.classList\.add\("is-settling"\)/);
  assert.match(css, /\.book-return-portal\.is-ready\s*\{[^}]*opacity:1;[^}]*transition:none;/s);
  assert.match(css, /\.book-return-portal\.is-settling\s*\{[^}]*opacity:0;[^}]*transition:opacity 180ms linear;/s);
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

test("crossfades the full-screen magic mirror into the archive without scaling", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /function createMirrorReturnPortal\(persona\)/);
  assert.match(app, /portal\.className = "mirror-return-portal"/);
  assert.match(app, /elements\.archiveView\.classList\.toggle\("is-mirror-returning", isReturningMirror\)/);
  assert.match(app, /elements\.archiveView\.classList\.remove\("is-mirror-returning"\)/);
  assert.match(css, /\.mirror-return-portal\.is-returning\s*\{[^}]*mirrorFullScreenFadeOut/s);
  assert.match(css, /\.archive-view\.is-mirror-returning\s*\{[^}]*archiveMirrorFadeIn/s);
  const mirrorFade = css.match(/@keyframes mirrorFullScreenFadeOut\s*\{([^}]*(?:\}[^@]*)?)/)?.[1] || "";
  assert.doesNotMatch(mirrorFade, /transform|scale|translate/);
});

test("reconstructs the reference opening with a fixed cover and sequential code-rendered leaves", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.equal((html.match(/hinge-turning-leaf hinge-leaf-/g) || []).length, 5);
  assert.match(html, /B · 参考视频代码版/);
  assert.match(app, /return \["crisp", "hinge", "legacy"\]\.includes\(saved\) \? saved : "hinge"/);
  assert.match(app, /state\.motionMode === "hinge" \? REFERENCE_OPEN_MS : 4_350/);
  assert.match(css, /@keyframes referenceCoverOpen/);
  assert.match(css, /@keyframes referenceLeafTurn/);
  assert.match(css, /\.hinge-page-block\s*\{[^}]*inset:4\.2% 4\.8% 4\.5% 0;/s);
  assert.match(css, /\.hinge-turning-leaf\s*\{[^}]*inset:4\.2% 4\.8% 4\.5% 0;/s);
  assert.match(css, /\.hinge-leaf-5[^\n]*--leaf-z:2px;z-index:17/);
  assert.match(css, /@keyframes referenceRightPageExpand/);
  assert.match(css, /@keyframes referenceRightPageContract/);
  assert.match(css, /@keyframes referenceCoverCloseV16/);
  assert.match(css, /rotateY\(-180deg\)/);
});

test("keeps both cover faces composited while the iPad Safari hinge crosses ninety degrees", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const coverOpen = css.match(/@keyframes referenceCoverOpenV16\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const coverClose = css.match(/@keyframes referenceCoverCloseV16\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(css, /\.hinge-front-cover\s*\{[^}]*-webkit-transform-style:preserve-3d;[^}]*backface-visibility:visible;[^}]*-webkit-backface-visibility:visible;[^}]*will-change:transform;[^}]*filter:none;/s);
  assert.match(css, /\.scene-view\[data-motion="hinge"\] \.opening-book-stage\s*\{[^}]*-webkit-transform-style:preserve-3d;[^}]*will-change:transform,opacity;[^}]*filter:none;/s);
  assert.match(css, /\.scene-view\[data-motion="hinge"\] \.opening-hinge-rig\s*\{[^}]*-webkit-transform-style:preserve-3d;/s);
  assert.match(css, /\.hinge-book\s*\{[^}]*-webkit-transform-style:preserve-3d;/s);
  assert.match(css, /\.hinge-cover-face\s*\{[^}]*backface-visibility:hidden;[^}]*-webkit-backface-visibility:hidden;/s);
  assert.match(css, /\.hinge-cover-outer\s*\{[^}]*box-shadow:[^}]*transform:translateZ\(\.4px\);/s);
  assert.match(css, /\.hinge-cover-inner\s*\{[^}]*transform:rotateY\(180deg\) translateZ\(\.4px\);/s);
  assert.doesNotMatch(coverOpen, /filter:/);
  assert.doesNotMatch(coverClose, /filter:/);
});

test("keeps the page core present and crossfades its last second into the identical writable fullscreen state", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const coverOpen = css.match(/@keyframes referenceCoverOpenV16\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const pageExpand = css.match(/@keyframes referenceRightPageExpand\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const stageOpen = css.match(/@keyframes referenceStageOpen\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.doesNotMatch(css, /referenceBookCore(?:Unmask|Mask)[\s\S]{0,500}visibility:hidden/);
  assert.match(css, /is-book-opening \.hinge-page-block\s*\{\s*visibility:visible;\s*animation:referenceBookCoreUnmask 5\.6s linear both;/s);
  assert.match(css, /@keyframes referenceBookCoreUnmask\s*\{[\s\S]*0%,18%\s*\{ clip-path:inset\(0 0 0 1\.8%/);
  assert.match(css, /@keyframes referenceBookCoreMask\s*\{[\s\S]*80%,100%\s*\{ clip-path:inset\(0 0 0 1\.8%/);
  assert.match(css, /var\(--opening-cover-image\) center \/ 100% 100% no-repeat,[\s\S]*linear-gradient\(#1a100b,#1a100b\) center \/ 95\.6% 97\.2% no-repeat/);
  assert.match(css, /referenceCoverCloseV16 1\.4s 3\.58s/);
  assert.match(css, /inset:4\.2% 4\.8% 4\.5% 0;/);
  assert.ok((coverOpen.match(/rotateY\(/g) || []).length >= 12);
  assert.match(pageExpand, /0%,81%\s*\{ opacity:0;transform:none;filter:none;/);
  assert.match(pageExpand, /92%\s*\{ opacity:\.42;transform:none;filter:none;/);
  assert.match(pageExpand, /99\.8%,100%\s*\{ opacity:1;transform:none;filter:none;/);
  assert.doesNotMatch(pageExpand, /translateX|scale\(/);
  assert.match(css, /@keyframes referenceSequenceOpen\s*\{[\s\S]*92%\s*\{ opacity:\.68;visibility:visible; \}[\s\S]*100%\s*\{ opacity:0;visibility:hidden; \}/);
  assert.doesNotMatch(stageOpen, /opacity:0/);
});

test("adds a third shelf and gives custom books one editable memory-backed cover template", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(app, /customShelf\.className = "book-shelf-row shelf-custom"/);
  assert.match(app, /customCover\.className = "flat-cover-image flat-cover-visual custom-cover-visual"/);
  assert.match(app, /personaMemoryStore\.save\(book\.id, elements\.customMemory\.value\)/);
  assert.match(html, /id="customMemory"[^>]*maxlength="600"/);
  assert.match(css, /\.persona-list \.shelf-custom\s*\{/);
  assert.match(css, /\.persona-list \.shelf-upper \{ bottom:calc\(var\(--upper-shelf-bottom\) \+ 48px\); \}/);
  assert.match(css, /\.mirror-entry-label\s*\{[^}]*top:36%;/s);
  assert.match(css, /\.back-button\s*\{[^}]*"PingFang SC"/s);
  assert.match(css, /\.custom-cover-visual\s*\{/);
  assert.match(css, /archive-three-shelves\.png/);
  assert.match(css, /\.scene-view\.is-handoff-opening\.is-book-opening \.opening-sequence\s*\{[^}]*archive-three-shelves\.png/s);
  assert.match(css, /\.scene-view\.is-closing-to-shelf\.is-closing-book \.opening-sequence\s*\{[^}]*archive-three-shelves\.png/s);
  assert.match(app, /custom-book-delete/);
  assert.match(app, /customBookStore\.remove\(persona\.id\)/);
  assert.match(app, /personaMemoryStore\.clear\(persona\.id\)/);
  assert.match(app, /historyStore\.clear\(persona\.id\)/);
});

test("gives all nine default books visible original profiles and editable profile fields", async () => {
  assert.equal(PERSONAS.length, 9);
  for (const persona of PERSONAS) {
    assert.ok(persona.identity?.length > 20, `${persona.id} needs an original identity`);
    assert.ok(persona.personality?.length > 20, `${persona.id} needs an original personality`);
  }
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(html, /原本人设 · 只读/);
  assert.match(html, /id="defaultPersonaIdentity"/);
  assert.match(html, /id="defaultPersonaPersonality"/);
  assert.match(html, /id="personaIdentity"[^>]*maxlength="500"/);
  assert.match(html, /id="personaPersonality"[^>]*maxlength="500"/);
  assert.match(app, /personaProfileStore\.save\(state\.persona\.id/);
  assert.match(app, /personaProfile: state\.persona\.isCustom \? null : personaProfileStore\.load/);
});

test("keeps the parchment panoramic by default and blocks native selection inside handwriting", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const ink = await readFile(new URL("../public/modules/ink-engine.js", import.meta.url), "utf8");
  assert.match(css, /\.drawer-pull\s*\{[^}]*width: 1px;[^}]*opacity: 0;[^}]*pointer-events: none;/s);
  assert.match(app, /shouldOpenDrawerFromEdge\(state\.edgePullStart, point\)/);
  assert.match(app, /\["touch", "mouse"\]\.includes\(event\.pointerType\)/);
  assert.match(css, /\.writing-surface\s*\{[^}]*-webkit-user-select: none;[^}]*user-select: none;[^}]*-webkit-touch-callout: none;/s);
  assert.match(css, /#inkCanvas[^\n]*touch-action: none;[^\n]*outline:none;/);
  assert.match(ink, /addEventListener\("contextmenu", this\.preventNativeInteraction\)/);
  assert.match(ink, /if \(event\?\.cancelable\) event\.preventDefault\(\)/);
});

test("keeps iPad opening and closing transitions on one stable trajectory", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const stableClose = css.match(/\/\* V20[\s\S]*?@keyframes referenceStageClose\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const stableReturn = css.match(/\/\* V20[\s\S]*?@keyframes bookPortalReturnSharp\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const stableLeaves = css.match(/\/\* V20[\s\S]*?@keyframes referenceLeafCloseV16\s*\{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(css, /\/\* V20[\s\S]*?\.archive-view\.is-opening-book\s*\{[^}]*transform:none!important;/s);
  assert.match(css, /\/\* V20[\s\S]*?\.scene-view\.is-pinching \.paper-object\s*\{[^}]*transform:none;[^}]*filter:none;[^}]*transition:none;/s);
  assert.match(css, /\/\* V20[\s\S]*?background-attachment:scroll;/s);
  assert.match(stableClose, /translate3d\(-25%,0,0\) scale\(2\.9\)/);
  assert.match(stableClose, /translate3d\(-25%,0,0\) scale\(1\)/);
  assert.doesNotMatch(stableClose, /translateX\(0\)|filter:/);
  assert.doesNotMatch(stableReturn, /calc\(|filter:/);
  assert.doesNotMatch(stableLeaves, /filter:/);
});

test("shows whether real AI, an edited persona, and memory are actually active", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const client = await readFile(new URL("../public/modules/ai-client.js", import.meta.url), "utf8");
  const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(client, /fetch\("\/api\/status"/);
  assert.match(app, /当前人设：.*修改版优先生效/s);
  assert.match(app, /修改版已保存，等待真实 AI/);
  assert.match(app, /长期记忆：.*已载入/s);
  assert.match(app, /演示模式 · 不会识别手写，也不会调用人物设定和记忆/);
  assert.match(sw, /answering-library-local-app-v31/);
  assert.match(sw, /pathname\.startsWith\("\/api\/"\)/);
});
