import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PERSONAS = ["socrates", "da-vinci", "shakespeare", "jung", "einstein"];

class Raster {
  constructor(width, height, color = [0, 0, 0, 0]) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
    this.clear(color);
  }

  clear(color) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) this.set(x, y, color);
    }
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    this.data[index] = color[0];
    this.data[index + 1] = color[1];
    this.data[index + 2] = color[2];
    this.data[index + 3] = color[3] ?? 255;
  }

  blend(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    const alpha = (color[3] ?? 255) / 255;
    const inv = 1 - alpha;
    this.data[index] = Math.round(color[0] * alpha + this.data[index] * inv);
    this.data[index + 1] = Math.round(color[1] * alpha + this.data[index + 1] * inv);
    this.data[index + 2] = Math.round(color[2] * alpha + this.data[index + 2] * inv);
    this.data[index + 3] = Math.round(255 * alpha + this.data[index + 3] * inv);
  }

  rect(x, y, width, height, color) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + width));
    const y1 = Math.min(this.height, Math.ceil(y + height));
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) this.blend(xx, yy, color);
    }
  }

  gradientRect(x, y, width, height, top, bottom) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + width));
    const y1 = Math.min(this.height, Math.ceil(y + height));
    for (let yy = y0; yy < y1; yy += 1) {
      const t = (yy - y0) / Math.max(1, y1 - y0);
      const color = mix(top, bottom, t);
      for (let xx = x0; xx < x1; xx += 1) this.blend(xx, yy, color);
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.blend(x, y, color);
      }
    }
  }

  line(x0, y0, x1, y1, color, width = 1) {
    const minX = Math.floor(Math.min(x0, x1) - width);
    const maxX = Math.ceil(Math.max(x0, x1) + width);
    const minY = Math.floor(Math.min(y0, y1) - width);
    const maxY = Math.ceil(Math.max(y0, y1) + width);
    const length = Math.hypot(x1 - x0, y1 - y0) || 1;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = distanceToSegment(x + 0.5, y + 0.5, x0, y0, x1, y1, length);
        if (distance <= width / 2) this.blend(x, y, color);
      }
    }
  }

  noise(amount, seed, alpha = 20) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const value = (hash(x, y, seed) - 0.5) * amount;
        this.blend(x, y, [clamp(128 + value, 0, 255), clamp(128 + value, 0, 255), clamp(128 + value, 0, 255), alpha]);
      }
    }
  }
}

function generateSocrates() {
  const bg = new Raster(1448, 1086, [25, 28, 28, 255]);
  bg.gradientRect(0, 0, 1448, 1086, [36, 42, 44, 255], [9, 10, 10, 255]);
  bg.rect(0, 648, 1448, 438, [38, 35, 31, 190]);
  for (let i = 0; i < 7; i += 1) {
    const x = 110 + i * 190;
    const w = 62 - i * 1.2;
    bg.rect(x - 14, 128, w + 28, 34, [126, 118, 101, 135]);
    bg.gradientRect(x, 150, w, 570, [173, 165, 143, 150], [65, 62, 55, 155]);
    bg.rect(x - 20, 705, w + 40, 28, [91, 82, 67, 140]);
    bg.line(x + w * 0.36, 170, x + w * 0.32, 680, [226, 218, 190, 30], 3);
    bg.line(x + w * 0.72, 170, x + w * 0.68, 680, [26, 23, 18, 50], 5);
  }
  for (let y = 742; y < 1086; y += 58) bg.line(0, y, 1448, y - 130, [150, 137, 109, 42], 3);
  bg.ellipse(1120, 210, 260, 110, [204, 191, 158, 26]);
  bg.noise(34, 11, 18);
  writeAsset("socrates", "background-source.png", bg);
  writeWebp("socrates", "background-source.png", "background.webp", 82);

  const paper = new Raster(1100, 820);
  paper.rect(62, 54, 976, 710, [94, 55, 28, 250]);
  paper.rect(96, 88, 908, 642, [72, 43, 25, 255]);
  paper.gradientRect(130, 132, 840, 552, [86, 75, 62, 245], [47, 42, 36, 250]);
  paper.rect(146, 150, 808, 516, [57, 52, 46, 130]);
  for (let i = 0; i < 140; i += 1) {
    const x = 155 + hash(i, 3, 12) * 780;
    const y = 160 + hash(i, 7, 13) * 490;
    paper.line(x, y, x + 20 + hash(i, 8, 14) * 64, y + (hash(i, 9, 15) - 0.5) * 18, [176, 160, 122, 28], 1);
  }
  for (let i = 0; i < 45; i += 1) {
    const x = 90 + hash(i, 15, 16) * 930;
    const y = 70 + hash(i, 18, 17) * 660;
    paper.line(x, y, x + (hash(i, 21, 18) - 0.5) * 90, y + 40, [35, 18, 8, 35], 2);
  }
  paper.noise(38, 19, 14);
  writeAsset("socrates", "paper-source.png", paper);
  writeAsset("socrates", "paper.png", paper, true);
}

function generateDaVinci() {
  const bg = new Raster(1448, 1086, [31, 23, 17, 255]);
  bg.gradientRect(0, 0, 1448, 1086, [74, 52, 34, 255], [12, 11, 10, 255]);
  bg.rect(96, 105, 364, 460, [26, 22, 17, 180]);
  bg.rect(126, 132, 304, 398, [155, 123, 80, 76]);
  bg.line(278, 132, 278, 530, [213, 182, 124, 28], 3);
  bg.line(126, 332, 430, 332, [213, 182, 124, 28], 3);
  bg.rect(770, 145, 420, 310, [41, 31, 22, 160]);
  for (let i = 0; i < 7; i += 1) bg.line(805, 190 + i * 35, 1145, 160 + i * 35, [182, 151, 102, 38], 2);
  for (let i = 0; i < 5; i += 1) bg.ellipse(965 + i * 36, 650 + i * 7, 70, 18, [190, 147, 78, 28]);
  bg.rect(0, 735, 1448, 351, [48, 32, 18, 190]);
  for (let i = 0; i < 38; i += 1) {
    const x = 610 + hash(i, 2, 31) * 680;
    const y = 500 + hash(i, 4, 32) * 270;
    bg.line(x, y, x + 80 * Math.cos(i), y + 35 * Math.sin(i * 1.7), [209, 166, 104, 32], 1);
  }
  bg.ellipse(220, 220, 250, 185, [220, 183, 115, 35]);
  bg.noise(46, 33, 18);
  writeAsset("da-vinci", "background-source.png", bg);
  writeWebp("da-vinci", "background-source.png", "background.webp", 82);

  const paper = oldPaper(900, 1160, [215, 190, 140, 255], [160, 121, 70, 255], 41);
  for (let i = 0; i < 12; i += 1) paper.line(86, 158 + i * 72, 802, 143 + i * 73, [102, 70, 38, 24], 1);
  paper.ellipse(685, 192, 92, 92, [91, 58, 29, 22]);
  paper.ellipse(685, 192, 54, 54, [91, 58, 29, 18]);
  for (let i = 0; i < 11; i += 1) paper.line(602, 300 + i * 22, 785, 280 + i * 17, [91, 58, 29, 22], 1);
  paper.line(140, 980, 355, 840, [91, 58, 29, 30], 2);
  paper.line(145, 960, 395, 976, [91, 58, 29, 22], 1);
  writeAsset("da-vinci", "paper-source.png", paper);
  writeAsset("da-vinci", "paper.png", paper, true);
}

function generateShakespeare() {
  const bg = new Raster(1448, 1086, [19, 10, 8, 255]);
  bg.gradientRect(0, 0, 1448, 1086, [50, 22, 15, 255], [8, 7, 7, 255]);
  bg.rect(0, 720, 1448, 366, [43, 22, 13, 220]);
  bg.rect(102, 78, 285, 790, [69, 18, 17, 175]);
  bg.rect(1040, 92, 260, 725, [71, 21, 18, 155]);
  for (let x = 0; x < 1448; x += 95) bg.line(x, 735, x + 210, 1086, [137, 82, 43, 24], 3);
  bg.ellipse(405, 485, 260, 260, [225, 139, 62, 36]);
  bg.ellipse(405, 455, 70, 112, [242, 184, 83, 70]);
  bg.line(405, 368, 405, 525, [255, 210, 100, 105], 6);
  bg.rect(720, 445, 290, 205, [52, 28, 18, 130]);
  for (let i = 0; i < 7; i += 1) bg.line(760, 485 + i * 20, 972, 475 + i * 21, [221, 172, 100, 31], 1);
  bg.noise(42, 51, 20);
  writeAsset("shakespeare", "background-source.png", bg);
  writeWebp("shakespeare", "background-source.png", "background.webp", 82);

  const paper = oldPaper(900, 1160, [222, 202, 154, 255], [135, 84, 49, 255], 61);
  for (let i = 0; i < 11; i += 1) paper.line(112, 174 + i * 76, 785, 162 + i * 77, [84, 45, 29, 18], 1);
  paper.rect(102, 94, 700, 2, [101, 58, 34, 34]);
  paper.line(118, 1010, 785, 1004, [91, 51, 31, 18], 1);
  for (let i = 0; i < 16; i += 1) {
    const x = 80 + hash(i, 8, 62) * 740;
    const y = 70 + hash(i, 9, 63) * 1000;
    paper.ellipse(x, y, 26 + hash(i, 10, 64) * 35, 10 + hash(i, 11, 65) * 18, [88, 45, 30, 12]);
  }
  writeAsset("shakespeare", "paper-source.png", paper);
  writeAsset("shakespeare", "paper.png", paper, true);
}

function generateJung() {
  const bg = new Raster(1448, 1086, [14, 24, 22, 255]);
  bg.gradientRect(0, 0, 1448, 1086, [38, 57, 51, 255], [9, 11, 10, 255]);
  bg.rect(70, 105, 410, 700, [24, 31, 27, 190]);
  for (let i = 0; i < 8; i += 1) {
    bg.rect(104, 144 + i * 74, 335, 18, [103, 85, 58, 90]);
    for (let j = 0; j < 11; j += 1) bg.rect(116 + j * 29, 162 + i * 74, 18, 48, [80 + j * 5, 63, 47, 95]);
  }
  bg.ellipse(1040, 260, 200, 200, [140, 151, 129, 36]);
  bg.ellipse(1040, 260, 120, 120, [20, 34, 34, 120]);
  bg.rect(825, 660, 425, 190, [40, 34, 29, 170]);
  bg.ellipse(650, 670, 155, 95, [56, 62, 50, 120]);
  bg.ellipse(690, 505, 128, 128, [36, 42, 36, 145]);
  for (let i = 0; i < 9; i += 1) {
    const cx = 960 + Math.cos(i) * 90;
    const cy = 732 + Math.sin(i * 2) * 35;
    bg.ellipse(cx, cy, 18, 18, [151, 139, 95, 45]);
  }
  bg.noise(40, 71, 18);
  writeAsset("jung", "background-source.png", bg);
  writeWebp("jung", "background-source.png", "background.webp", 82);

  const paper = oldPaper(900, 1120, [205, 206, 185, 255], [91, 111, 93, 255], 81);
  paper.rect(114, 112, 2, 900, [107, 80, 70, 58]);
  for (let y = 154; y < 970; y += 50) paper.line(105, y, 796, y, [69, 89, 77, 38], 1);
  paper.ellipse(724, 172, 45, 45, [42, 70, 61, 18]);
  paper.ellipse(724, 172, 21, 21, [42, 70, 61, 20]);
  paper.line(676, 220, 773, 128, [42, 70, 61, 18], 1);
  writeAsset("jung", "paper-source.png", paper);
  writeAsset("jung", "paper.png", paper, true);
}

function generateEinstein() {
  const bg = new Raster(1448, 1086, [18, 22, 21, 255]);
  bg.gradientRect(0, 0, 1448, 1086, [34, 43, 42, 255], [9, 10, 10, 255]);
  bg.rect(110, 90, 820, 520, [24, 45, 41, 190]);
  for (let i = 0; i < 22; i += 1) {
    const y = 135 + i * 21;
    bg.line(160, y, 865, y + Math.sin(i) * 8, [184, 191, 171, 18], 1);
  }
  for (let i = 0; i < 17; i += 1) {
    const x = 190 + hash(i, 2, 91) * 635;
    const y = 150 + hash(i, 4, 92) * 390;
    bg.line(x, y, x + 95 * Math.cos(i * 1.3), y + 40 * Math.sin(i * 0.9), [204, 204, 184, 28], 2);
  }
  bg.rect(0, 700, 1448, 386, [44, 36, 27, 220]);
  for (let i = 0; i < 6; i += 1) {
    const x = 780 + i * 62;
    bg.rect(x, 690 + i * 7, 170, 112, [200, 190, 166, 38]);
    bg.line(x + 20, 720 + i * 7, x + 145, 706 + i * 7, [88, 86, 78, 26], 1);
  }
  bg.ellipse(1110, 315, 190, 120, [195, 185, 145, 24]);
  bg.noise(38, 93, 18);
  writeAsset("einstein", "background-source.png", bg);
  writeWebp("einstein", "background-source.png", "background.webp", 82);

  const paper = oldPaper(960, 1120, [216, 214, 199, 255], [110, 116, 108, 255], 101);
  for (let x = 92; x < 870; x += 32) paper.line(x, 92, x, 1016, [65, 88, 116, 36], 1);
  for (let y = 96; y < 1022; y += 32) paper.line(82, y, 880, y, [65, 88, 116, 32], 1);
  for (let y = 96; y < 1022; y += 160) paper.line(82, y, 880, y, [65, 88, 116, 55], 1);
  paper.line(154, 110, 154, 1002, [128, 72, 61, 40], 1);
  for (let i = 0; i < 4; i += 1) paper.ellipse(74, 210 + i * 210, 16, 16, [78, 77, 70, 54]);
  writeAsset("einstein", "paper-source.png", paper);
  writeAsset("einstein", "paper.png", paper, true);
}

function oldPaper(width, height, base, edge, seed) {
  const raster = new Raster(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const margin = Math.min(x, y, width - 1 - x, height - 1 - y);
      const rag = 17 + hash(Math.floor(y / 9), Math.floor(x / 13), seed) * 20;
      if (margin < rag) continue;
      const edgeT = clamp((54 - margin) / 54, 0, 1);
      const color = mix(base, edge, edgeT * 0.62);
      const stain = hash(Math.floor(x / 31), Math.floor(y / 29), seed + 4) * 18;
      raster.set(x, y, [
        clamp(color[0] + stain - 8, 0, 255),
        clamp(color[1] + stain - 8, 0, 255),
        clamp(color[2] + stain - 8, 0, 255),
        255
      ]);
    }
  }
  raster.noise(34, seed + 9, 13);
  for (let i = 0; i < 90; i += 1) {
    const x = 55 + hash(i, 1, seed + 12) * (width - 110);
    const y = 60 + hash(i, 2, seed + 13) * (height - 120);
    raster.line(x, y, x + (hash(i, 3, seed + 14) - 0.5) * 110, y + (hash(i, 4, seed + 15) - 0.5) * 40, [95, 70, 44, 12], 1);
  }
  return raster;
}

function writeAsset(id, name, raster, publicAsset = false) {
  const base = publicAsset
    ? join(ROOT, "public", "assets", "personas", id)
    : join(ROOT, "assets-source", "personas", id);
  const file = join(base, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(raster.width, raster.height, raster.data));
}

function writeWebp(id, sourceName, outputName, quality) {
  const source = join(ROOT, "assets-source", "personas", id, sourceName);
  const output = join(ROOT, "public", "assets", "personas", id, outputName);
  mkdirSync(dirname(output), { recursive: true });
  const result = spawnSync("cwebp", ["-quiet", "-q", String(quality), source, "-o", output], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`cwebp failed for ${id}`);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const crcInput = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(crcInput))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round((a[3] ?? 255) + ((b[3] ?? 255) - (a[3] ?? 255)) * t)
  ];
}

function hash(x, y, seed) {
  let n = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + seed * 144269, 2246822519);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 3266489917) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function distanceToSegment(px, py, x0, y0, x1, y1, length) {
  const t = clamp(((px - x0) * (x1 - x0) + (py - y0) * (y1 - y0)) / (length * length), 0, 1);
  const x = x0 + (x1 - x0) * t;
  const y = y0 + (y1 - y0) * t;
  return Math.hypot(px - x, py - y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

for (const persona of PERSONAS) {
  if (persona === "socrates") generateSocrates();
  if (persona === "da-vinci") generateDaVinci();
  if (persona === "shakespeare") generateShakespeare();
  if (persona === "jung") generateJung();
  if (persona === "einstein") generateEinstein();
}
