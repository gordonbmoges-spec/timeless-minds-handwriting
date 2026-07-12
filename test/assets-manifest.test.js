import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { PERSONA_ASSETS } from "../public/assets/personas/manifest.js";
import { PERSONAS } from "../public/data/personas.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("all registered personas have local scene assets", () => {
  for (const persona of PERSONAS) {
    const assets = PERSONA_ASSETS[persona.id];
    assert.ok(assets, `${persona.id} should have an asset manifest entry`);

    for (const key of ["background", "paper", "portrait"]) {
      const publicPath = assets[key];
      assert.equal(publicPath.startsWith("/assets/personas/"), true, `${persona.id}.${key} should use a local asset path`);
      const filePath = join(root, "public", publicPath);
      assert.equal(existsSync(filePath), true, `${persona.id}.${key} should exist`);
      assert.equal(statSync(filePath).size > 1000, true, `${persona.id}.${key} should not be empty`);
    }
  }
});

test("persona writing areas stay inside the paper", () => {
  for (const [id, assets] of Object.entries(PERSONA_ASSETS)) {
    assert.equal(Number.isFinite(assets.paperAspectRatio), true, `${id} should declare a paper aspect ratio`);
    assert.equal(assets.paperAspectRatio > 0.5 && assets.paperAspectRatio < 1.5, true, `${id} paper ratio should be reasonable`);

    const { x, y, width, height } = assets.writingArea;
    assert.equal(x >= 0 && y >= 0, true, `${id} writing area should start inside the paper`);
    assert.equal(width > 0.2 && height > 0.2, true, `${id} writing area should be usable`);
    assert.equal(x + width <= 1, true, `${id} writing area should not overflow horizontally`);
    assert.equal(y + height <= 1, true, `${id} writing area should not overflow vertically`);
  }
});
