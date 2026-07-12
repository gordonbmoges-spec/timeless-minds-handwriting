import assert from "node:assert/strict";
import { test } from "node:test";

import { personaPath, routeFromPath } from "../public/modules/router.js";

test("parses archive and persona routes", () => {
  assert.deepEqual(routeFromPath("/"), { view: "archive", personaId: null });
  assert.deepEqual(routeFromPath("/persona/confucius"), { view: "persona", personaId: "confucius" });
  assert.deepEqual(routeFromPath("/persona/da-vinci/"), { view: "persona", personaId: "da-vinci" });
});

test("builds a stable persona path", () => {
  assert.equal(personaPath("socrates"), "/persona/socrates");
});
