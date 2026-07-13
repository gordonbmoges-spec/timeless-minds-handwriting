import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const files = process.argv.slice(2);
if (!files.length) {
  throw new Error("Usage: node scripts/clean-green-alpha.mjs <png> [...]");
}

for (const file of files) {
  const image = decodePng(readFileSync(file));
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const alpha = image.data[i + 3];
    const greenSpill = g > 45 && g > b + 8 && r < g + 18;
    const chromaGreen = g > 140 && r < 130 && b < 130;
    if (alpha > 0 && chromaGreen) {
      image.data[i + 3] = 0;
      image.data[i] = 0;
      image.data[i + 1] = 0;
      image.data[i + 2] = 0;
    } else if (alpha > 0 && greenSpill) {
      image.data[i + 1] = Math.min(g, Math.max(r, b) + 2);
    }
  }
  writeFileSync(file, encodePng(image.width, image.height, image.data));
}

function decodePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error("Not a PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`Unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height || colorType !== 6) throw new Error("Missing PNG header");

  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = Buffer.alloc(stride * height);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = inflated.subarray(inputOffset, inputOffset + stride);
    inputOffset += stride;
    const previousRow = y === 0 ? null : data.subarray((y - 1) * stride, y * stride);
    const outputRow = data.subarray(y * stride, (y + 1) * stride);
    unfilter(row, outputRow, previousRow, filter, 4);
  }

  return { width, height, data };
}

function unfilter(input, output, previous, filter, bpp) {
  for (let x = 0; x < input.length; x += 1) {
    const left = x >= bpp ? output[x - bpp] : 0;
    const up = previous ? previous[x] : 0;
    const upLeft = previous && x >= bpp ? previous[x - bpp] : 0;
    let value = input[x];
    if (filter === 1) value = (value + left) & 255;
    else if (filter === 2) value = (value + up) & 255;
    else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
    else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 255;
    else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
    output[x] = value;
  }
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
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
