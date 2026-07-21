import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, webkit } = require("playwright");

const baseUrl = process.argv[2] || "http://localhost:3109";
const outputDirectory = path.resolve(process.argv[3] || "artifacts/ipad-cover-continuity");
const personaId = process.argv[4] || "einstein";
const frameIntervalMs = 50;
const frameCount = 140;

await mkdir(outputDirectory, { recursive: true });

let engine = "webkit";
let browser;
try {
  browser = await webkit.launch({ headless: true });
} catch {
  engine = "chromium-system";
  browser = await chromium.launch({ channel: "chrome", headless: true });
}
const context = await browser.newContext({
  viewport: { width: 820, height: 1180 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
  serviceWorkers: "block",
  recordVideo: { dir: outputDirectory, size: { width: 820, height: 1180 } },
  userAgent: "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
});
const page = await context.newPage();
const recordedVideo = page.video();
const browserMessages = [];
page.on("console", (message) => {
  if (["warning", "error"].includes(message.type())) browserMessages.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => browserMessages.push(`pageerror: ${error.message}`));

await page.goto(`${baseUrl}/?cover-continuity=${Date.now()}`, { waitUntil: "networkidle" });
const book = page.locator(`[data-persona-id="${personaId}"]`);
await book.waitFor({ state: "visible" });
await page.waitForTimeout(300);
await book.click({ position: { x: 40, y: 80 } });

const startedAt = Date.now();
const observations = [];
for (let index = 0; index < frameCount; index += 1) {
  const targetTime = index * frameIntervalMs;
  const waitTime = targetTime - (Date.now() - startedAt);
  if (waitTime > 0) await page.waitForTimeout(waitTime);
  const state = await page.evaluate(() => {
    const source = document.querySelector(".flat-cover-card.is-opening, .flat-cover-card.is-opening-pending");
    const portal = document.querySelector(".book-transition-portal");
    const frontCover = document.querySelector(".hinge-front-cover");
    const outerCover = document.querySelector(".hinge-cover-outer");
    const innerCover = document.querySelector(".hinge-cover-inner");
    const snapshot = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        display: style.display,
        transform: style.transform,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    return {
      path: location.pathname,
      source: snapshot(source),
      portal: snapshot(portal),
      frontCover: snapshot(frontCover),
      outerCover: snapshot(outerCover),
      innerCover: snapshot(innerCover)
    };
  });
  observations.push({ frame: index, timeMs: Date.now() - startedAt, ...state });
}

await page.close();
const videoPath = path.join(outputDirectory, "cover-continuity.webm");
await recordedVideo.saveAs(videoPath);
await context.close();
await browser.close();
process.stdout.write(`${JSON.stringify({ engine, outputDirectory, videoPath, observations, browserMessages }, null, 2)}\n`);
