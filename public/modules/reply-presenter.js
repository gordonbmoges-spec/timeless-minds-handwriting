export function createReplyState() {
  return { current: null };
}

export function showSingleReply(_state, reply) {
  return {
    current: {
      ...reply,
      alpha: 1,
      fading: false
    }
  };
}

export function startReplyFade(state) {
  if (!state.current || state.current.fading) return state;
  return { current: { ...state.current, fading: true } };
}

export function advanceReplyFade(state, progress) {
  if (!state.current) return state;
  const value = Math.min(1, Math.max(0, progress));
  if (value >= 1) return createReplyState();
  return { current: { ...state.current, alpha: 1 - value, fading: true } };
}

export function wrapReplyLines(text, maxWidth, measureText) {
  const lines = [];
  let line = "";
  for (const char of Array.from(String(text || ""))) {
    if (char === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const candidate = `${line}${char}`;
    if (line && measureText(candidate) > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = candidate;
    }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

export class ReplyPresenter {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    this.dpr = Math.max(1, Math.min(globalThis.devicePixelRatio || 1, 2));
    this.width = 1;
    this.height = 1;
    this.state = createReplyState();
    this.holdMs = options.holdMs ?? 10_000;
    this.fadeMs = options.fadeMs ?? 1_800;
    this.reducedMotion = options.reducedMotion ?? false;
    this.autoTimer = null;
    this.frameId = null;
    this.animationToken = 0;
    this.onCleared = options.onCleared || (() => {});
  }

  resize(width, height) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  async show(text, options = {}) {
    const clean = String(text || "").trim();
    if (!clean) return;
    this.cancelAnimations();
    const block = {
      text: clean,
      reveal: 0,
      direction: options.direction || "horizontal-tb",
      color: options.color || "#2f302c",
      fontFamily: options.fontFamily || '"STKaiti", "KaiTi", serif',
      fontSize: clamp(Number(options.fontSize) || 38, 24, 56),
      pace: clamp(Number(options.pace) || 1, 0.65, 1.6),
      align: options.align || "center",
      topRatio: clamp(Number(options.topRatio) || 0.08, 0.03, 0.3),
      maxWidthRatio: clamp(Number(options.maxWidthRatio) || 0.82, 0.45, 0.94)
    };
    this.state = showSingleReply(this.state, block);
    const token = ++this.animationToken;
    const total = Array.from(clean).length;
    const duration = this.reducedMotion ? 1 : Math.max(500, total * (44 / block.pace));
    const start = now();

    await new Promise((resolve) => {
      const tick = (timestamp) => {
        if (token !== this.animationToken || !this.state.current) {
          resolve();
          return;
        }
        const progress = Math.min(1, (timestamp - start) / duration);
        this.state.current.reveal = Math.max(1, Math.ceil(total * progress));
        this.draw();
        if (progress < 1) {
          this.frameId = requestFrame(tick);
        } else {
          this.frameId = null;
          resolve();
        }
      };
      this.frameId = requestFrame(tick);
    });

    if (token === this.animationToken && this.state.current) {
      this.autoTimer = setTimeout(() => this.fade(), this.holdMs);
    }
  }

  fade(duration = this.fadeMs) {
    if (!this.state.current || this.state.current.fading) return;
    clearTimeout(this.autoTimer);
    this.autoTimer = null;
    this.state = startReplyFade(this.state);
    const token = ++this.animationToken;
    const fadeDuration = this.reducedMotion ? 1 : duration;
    const start = now();

    const tick = (timestamp) => {
      if (token !== this.animationToken || !this.state.current) return;
      const progress = Math.min(1, (timestamp - start) / fadeDuration);
      this.state = advanceReplyFade(this.state, progress);
      this.draw();
      if (progress < 1) {
        this.frameId = requestFrame(tick);
      } else {
        this.frameId = null;
        this.onCleared();
      }
    };
    this.frameId = requestFrame(tick);
  }

  clear() {
    this.cancelAnimations();
    this.state = createReplyState();
    this.draw();
    this.onCleared();
  }

  hasReply() {
    return Boolean(this.state.current);
  }

  cancelAnimations() {
    clearTimeout(this.autoTimer);
    this.autoTimer = null;
    if (this.frameId !== null) cancelFrame(this.frameId);
    this.frameId = null;
    this.animationToken += 1;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    const block = this.state.current;
    if (!block) return;
    this.ctx.save();
    this.ctx.globalAlpha = block.alpha;
    this.ctx.fillStyle = block.color;
    this.ctx.font = `${block.fontSize}px ${block.fontFamily}`;
    this.ctx.textBaseline = "top";
    if (block.direction === "vertical-rl") this.drawVertical(block);
    else this.drawHorizontal(block);
    this.ctx.restore();
  }

  drawVertical(block) {
    const allChars = Array.from(block.text);
    const chars = allChars.slice(0, block.reveal);
    const stepY = block.fontSize * 1.18;
    const stepX = block.fontSize * 1.34;
    const top = Math.max(18, this.height * block.topRatio);
    const rows = Math.max(1, Math.floor((this.height - top - 24) / stepY));
    const columnCount = Math.max(1, Math.ceil(allChars.length / rows));
    const right = this.width / 2 + ((columnCount - 1) * stepX) / 2;
    this.ctx.textAlign = "center";
    chars.forEach((char, index) => {
      const column = Math.floor(index / rows);
      const row = index % rows;
      this.ctx.fillText(char, right - column * stepX, top + row * stepY);
    });
  }

  drawHorizontal(block) {
    const lineHeight = block.fontSize * 1.25;
    const maxWidth = this.width * block.maxWidthRatio;
    const top = Math.max(18, this.height * block.topRatio);
    const lines = wrapReplyLines(block.text, maxWidth, (value) => this.ctx.measureText(value).width);
    let remaining = block.reveal;
    this.ctx.textAlign = "left";
    for (let index = 0; index < lines.length && remaining > 0; index += 1) {
      const fullLine = lines[index];
      const lineChars = Array.from(fullLine);
      const visibleLine = lineChars.slice(0, remaining).join("");
      const fullLineWidth = this.ctx.measureText(fullLine).width;
      const x = block.align === "center" ? (this.width - fullLineWidth) / 2 : (this.width - maxWidth) / 2;
      this.ctx.fillText(visibleLine, x, top + index * lineHeight);
      remaining -= lineChars.length;
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function requestFrame(callback) {
  const raf = globalThis.requestAnimationFrame || ((fn) => setTimeout(() => fn(now()), 16));
  return raf(callback);
}

function cancelFrame(id) {
  const cancel = globalThis.cancelAnimationFrame || clearTimeout;
  cancel(id);
}
