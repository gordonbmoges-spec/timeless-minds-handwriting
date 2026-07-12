import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectPointerSamples,
  computeInkBounds,
  smoothPressure,
  shouldIgnorePointer
} from "../public/modules/ink-engine.js";

test("collects every coalesced Apple Pencil sample in order", () => {
  const samples = [
    { clientX: 10, clientY: 20, pressure: 0.2, timeStamp: 1 },
    { clientX: 12, clientY: 22, pressure: 0.4, timeStamp: 2 },
    { clientX: 15, clientY: 25, pressure: 0.7, timeStamp: 3 }
  ];
  const event = {
    pointerType: "pen",
    getCoalescedEvents: () => samples
  };

  const points = collectPointerSamples(event, { left: 5, top: 10 });
  assert.deepEqual(points.map(({ x, y }) => [x, y]), [[5, 10], [7, 12], [10, 15]]);
  assert.deepEqual(points.map(({ pressure }) => pressure), [0.2, 0.4, 0.7]);
});

test("falls back to the pointer event when coalesced samples are unavailable", () => {
  const event = { clientX: 30, clientY: 40, pressure: 0, timeStamp: 9, pointerType: "mouse" };
  const points = collectPointerSamples(event, { left: 10, top: 15 });
  assert.equal(points.length, 1);
  assert.deepEqual([points[0].x, points[0].y], [20, 25]);
  assert.equal(points[0].pressure, 0.55);
});

test("smooths pressure jumps without discarding pressure intent", () => {
  assert.equal(smoothPressure(0.2, 1), 0.48);
  assert.equal(smoothPressure(0.8, 0), 0.52);
});

test("ignores broad touch contacts while keeping pen and mouse input", () => {
  assert.equal(shouldIgnorePointer({ pointerType: "touch", width: 34, height: 28 }, false), true);
  assert.equal(shouldIgnorePointer({ pointerType: "touch", width: 8, height: 8 }, true), true);
  assert.equal(shouldIgnorePointer({ pointerType: "pen", width: 2, height: 2 }, true), false);
  assert.equal(shouldIgnorePointer({ pointerType: "mouse", width: 1, height: 1 }, false), false);
});

test("computes padded ink bounds and ignores eraser-only strokes", () => {
  const strokes = [
    { mode: "pen", points: [{ x: 20, y: 30 }, { x: 80, y: 100 }] },
    { mode: "eraser", points: [{ x: 0, y: 0 }, { x: 200, y: 200 }] }
  ];
  assert.deepEqual(computeInkBounds(strokes, 10, 120, 140), {
    x: 10,
    y: 20,
    width: 80,
    height: 90
  });
});
