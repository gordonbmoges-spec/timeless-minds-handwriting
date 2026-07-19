import assert from "node:assert/strict";
import { test } from "node:test";

import { pinchRatio, pointDistance, shouldCloseFromPinch, shouldOpenDrawerFromEdge } from "../public/modules/book-gestures.js";

test("measures two-finger pinch contraction", () => {
  const start = [{ x: 100, y: 200 }, { x: 500, y: 200 }];
  const current = [{ x: 210, y: 200 }, { x: 390, y: 200 }];
  assert.equal(pointDistance(start[0], start[1]), 400);
  assert.equal(pinchRatio(start, current), 0.45);
  assert.equal(shouldCloseFromPinch(start, current), true);
});

test("does not close for small or accidental two-finger movement", () => {
  assert.equal(shouldCloseFromPinch(
    [{ x: 100, y: 100 }, { x: 220, y: 100 }],
    [{ x: 122, y: 100 }, { x: 198, y: 100 }]
  ), false);
  assert.equal(shouldCloseFromPinch(
    [{ x: 100, y: 100 }, { x: 500, y: 100 }],
    [{ x: 130, y: 100 }, { x: 470, y: 100 }]
  ), false);
});

test("opens the side page only from a deliberate left-edge pull", () => {
  assert.equal(shouldOpenDrawerFromEdge({ x: 12, y: 320 }, { x: 110, y: 326 }), true);
  assert.equal(shouldOpenDrawerFromEdge({ x: 90, y: 320 }, { x: 220, y: 324 }), false);
  assert.equal(shouldOpenDrawerFromEdge({ x: 12, y: 320 }, { x: 62, y: 420 }), false);
});
