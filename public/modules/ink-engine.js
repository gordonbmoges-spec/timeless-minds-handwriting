export function collectPointerSamples(event, rect) {
  const coalesced = typeof event.getCoalescedEvents === "function"
    ? event.getCoalescedEvents()
    : [];
  const samples = coalesced.length ? coalesced : [event];
  return samples.map((sample) => ({
    x: sample.clientX - rect.left,
    y: sample.clientY - rect.top,
    pressure: sample.pressure > 0 ? sample.pressure : 0.55,
    time: Number(sample.timeStamp) || performanceNow()
  }));
}

export function smoothPressure(previous, next, factor = 0.35) {
  return previous + (next - previous) * factor;
}

export function shouldIgnorePointer(event, penIsActive) {
  if (event.pointerType !== "touch") return false;
  if (penIsActive) return true;
  return Number(event.width || 0) > 24 || Number(event.height || 0) > 24;
}

export function computeInkBounds(strokes, padding, width, height) {
  const points = strokes
    .filter((stroke) => stroke.mode === "pen")
    .flatMap((stroke) => stroke.points);
  if (!points.length) return null;

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y)
  };
}

export class InkEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    this.onStrokeStart = options.onStrokeStart || (() => {});
    this.onStrokeEnd = options.onStrokeEnd || (() => {});
    this.canStart = options.canStart || (() => true);
    this.inkColor = options.inkColor || "#1f2522";
    this.tool = "pen";
    this.enabled = true;
    this.dpr = Math.max(1, Math.min(globalThis.devicePixelRatio || 1, 2));
    this.width = 1;
    this.height = 1;
    this.strokes = [];
    this.currentStroke = null;
    this.pendingPoints = [];
    this.activePointerId = null;
    this.activePointerType = null;
    this.penActiveUntil = 0;
    this.frameId = null;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.preventNativeInteraction = this.preventNativeInteraction.bind(this);
    this.flushFrame = this.flushFrame.bind(this);

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    const supportsRaw = "onpointerrawupdate" in globalThis;
    this.moveEventName = supportsRaw ? "pointerrawupdate" : "pointermove";
    canvas.addEventListener(this.moveEventName, this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    canvas.addEventListener("contextmenu", this.preventNativeInteraction);
    canvas.addEventListener("selectstart", this.preventNativeInteraction);
    canvas.addEventListener("dragstart", this.preventNativeInteraction);
  }

  destroy() {
    this.cancelFrame();
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener(this.moveEventName, this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("contextmenu", this.preventNativeInteraction);
    this.canvas.removeEventListener("selectstart", this.preventNativeInteraction);
    this.canvas.removeEventListener("dragstart", this.preventNativeInteraction);
  }

  resize(width, height) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.redraw();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  cancelActiveStroke() {
    this.cancelFrame();
    if (this.activePointerId !== null) this.canvas.releasePointerCapture?.(this.activePointerId);
    this.currentStroke = null;
    this.pendingPoints = [];
    this.activePointerId = null;
    this.activePointerType = null;
    this.redraw();
  }

  setTool(tool) {
    this.tool = tool === "eraser" ? "eraser" : "pen";
  }

  setInkColor(color) {
    this.inkColor = color || this.inkColor;
    this.redraw();
  }

  handlePointerDown(event) {
    this.preventNativeInteraction(event);
    const now = performanceNow();
    const penIsActive = this.activePointerType === "pen" || now < this.penActiveUntil;
    if (!this.enabled || !this.canStart() || shouldIgnorePointer(event, penIsActive)) return;
    if (this.activePointerId !== null) return;

    if (event.pointerType === "pen") this.penActiveUntil = now + 700;
    this.activePointerId = event.pointerId;
    this.activePointerType = event.pointerType || "mouse";
    this.canvas.setPointerCapture?.(event.pointerId);
    this.currentStroke = { mode: this.tool, points: [], alpha: 1 };
    this.pendingPoints = [];
    this.enqueue(event);
    this.onStrokeStart({ pointerType: this.activePointerType, tool: this.tool });
  }

  handlePointerMove(event) {
    this.preventNativeInteraction(event);
    if (event.pointerId !== this.activePointerId || !this.currentStroke) return;
    if (event.pointerType === "pen") this.penActiveUntil = performanceNow() + 700;
    this.enqueue(event);
  }

  handlePointerUp(event) {
    this.preventNativeInteraction(event);
    if (event.pointerId !== this.activePointerId || !this.currentStroke) return;
    this.enqueue(event);
    this.flushFrame();
    this.canvas.releasePointerCapture?.(event.pointerId);

    const stroke = this.currentStroke;
    this.currentStroke = null;
    this.pendingPoints = [];
    this.activePointerId = null;
    this.activePointerType = null;
    if (stroke.points.length > 1) {
      this.strokes.push(stroke);
      this.onStrokeEnd({ stroke, style: this.sampleStyle() });
    }
  }

  enqueue(event) {
    const rect = this.canvas.getBoundingClientRect();
    const samples = collectPointerSamples(event, rect);
    this.pendingPoints.push(...samples);
    this.scheduleFrame();
  }

  preventNativeInteraction(event) {
    if (event?.cancelable) event.preventDefault();
  }

  scheduleFrame() {
    if (this.frameId !== null) return;
    const raf = globalThis.requestAnimationFrame || ((callback) => setTimeout(() => callback(performanceNow()), 16));
    this.frameId = raf(this.flushFrame);
  }

  cancelFrame() {
    if (this.frameId === null) return;
    const cancel = globalThis.cancelAnimationFrame || clearTimeout;
    cancel(this.frameId);
    this.frameId = null;
  }

  flushFrame() {
    this.cancelFrame();
    if (!this.currentStroke || !this.pendingPoints.length) return;
    const startIndex = this.currentStroke.points.length;
    const accepted = [];
    let previous = this.currentStroke.points.at(-1) || null;

    for (const sample of this.pendingPoints) {
      const pressure = previous
        ? smoothPressure(previous.pressure, sample.pressure)
        : sample.pressure;
      const point = {
        ...sample,
        pressure,
        width: this.currentStroke.mode === "eraser" ? 24 : 1.6 + pressure * 4.6
      };
      if (previous && distance(previous, point) < 0.35) continue;
      accepted.push(point);
      previous = point;
    }

    this.pendingPoints = [];
    this.currentStroke.points.push(...accepted);
    this.drawStrokeRange(this.currentStroke, Math.max(1, startIndex));
  }

  drawStrokeRange(stroke, startIndex = 1) {
    const points = stroke.points;
    if (points.length < 2) return;
    this.ctx.save();
    this.ctx.globalAlpha = stroke.alpha ?? 1;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = this.inkColor;
    this.ctx.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";

    for (let i = Math.max(1, startIndex); i < points.length; i += 1) {
      const previous = points[i - 1];
      const current = points[i];
      const before = points[i - 2] || previous;
      const start = midpoint(before, previous);
      const end = midpoint(previous, current);
      this.ctx.lineWidth = stroke.mode === "eraser"
        ? current.width
        : Math.max(1.6, (previous.width + current.width) / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.quadraticCurveTo(previous.x, previous.y, end.x, end.y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const stroke of this.strokes) this.drawStrokeRange(stroke, 1);
    if (this.currentStroke) this.drawStrokeRange(this.currentStroke, 1);
  }

  clear() {
    this.cancelFrame();
    this.strokes = [];
    this.currentStroke = null;
    this.pendingPoints = [];
    this.activePointerId = null;
    this.activePointerType = null;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  hasInk() {
    return this.strokes.some((stroke) => stroke.mode === "pen" && stroke.points.length > 1);
  }

  exportPng() {
    const bounds = computeInkBounds(this.strokes, 28, this.width, this.height);
    if (!bounds) return null;
    const longSide = Math.max(bounds.width, bounds.height);
    const scale = longSide > 920 ? 920 / longSide : 1;
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.floor(bounds.width * scale));
    output.height = Math.max(1, Math.floor(bounds.height * scale));
    const outputCtx = output.getContext("2d");
    outputCtx.fillStyle = "#fffdf7";
    outputCtx.fillRect(0, 0, output.width, output.height);
    outputCtx.drawImage(
      this.canvas,
      bounds.x * this.dpr,
      bounds.y * this.dpr,
      bounds.width * this.dpr,
      bounds.height * this.dpr,
      0,
      0,
      output.width,
      output.height
    );
    return output.toDataURL("image/png");
  }

  sampleStyle() {
    const penPoints = this.strokes
      .filter((stroke) => stroke.mode === "pen")
      .flatMap((stroke) => stroke.points);
    if (!penPoints.length) return { inkWidth: 3, slant: 0, letterSize: 42, pace: 1 };
    const inkWidth = average(penPoints.map((point) => point.width));
    return {
      inkWidth: Number(inkWidth.toFixed(2)),
      slant: 0,
      letterSize: 42,
      pace: 1
    };
  }
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}
