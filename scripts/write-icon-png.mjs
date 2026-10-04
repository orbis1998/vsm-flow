import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function inRoundRect(x, y, size, radius) {
  if (x >= radius && x < size - radius && y >= 0 && y < size) return true;
  if (y >= radius && y < size - radius && x >= 0 && x < size) return true;
  const corners = [
    [radius, radius],
    [size - 1 - radius, radius],
    [radius, size - 1 - radius],
    [size - 1 - radius, size - 1 - radius],
  ];
  return corners.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2);
}

function inBar(x, y, size, x0, y0, w, h, r) {
  const lx = x - x0;
  const ly = y - y0;
  if (lx < 0 || ly < 0 || lx >= w || ly >= h) return false;
  if (lx >= r && lx < w - r) return true;
  if (ly >= r && ly < h - r) return true;
  const corners = [
    [r, r],
    [w - 1 - r, r],
    [r, h - 1 - r],
    [w - 1 - r, h - 1 - r],
  ];
  return corners.some(([cx, cy]) => (lx - cx) ** 2 + (ly - cy) ** 2 <= r ** 2);
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const radius = Math.round(size * (7 / 32));
  const bars = [
    { x: 7 / 32, y: 8 / 32, w: 18 / 32, h: 3.2 / 32, a: 255 },
    { x: 7 / 32, y: 14.4 / 32, w: 18 / 32, h: 3.2 / 32, a: 217 },
    { x: 7 / 32, y: 20.8 / 32, w: 12 / 32, h: 3.2 / 32, a: 255 },
  ];
  const br = Math.max(1, Math.round(size * (1 / 32)));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      if (!inRoundRect(x, y, size, radius)) {
        raw[i] = 0;
        raw[i + 1] = 0;
        raw[i + 2] = 0;
        raw[i + 3] = 0;
        continue;
      }
      let r = 0xc4;
      let g = 0x1e;
      let b = 0x3a;
      let a = 255;
      for (const bar of bars) {
        if (
          inBar(
            x,
            y,
            size,
            Math.round(bar.x * size),
            Math.round(bar.y * size),
            Math.round(bar.w * size),
            Math.max(2, Math.round(bar.h * size)),
            br,
          )
        ) {
          r = 255;
          g = 255;
          b = 255;
          a = bar.a;
        }
      }
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.resolve(process.cwd(), "public");
fs.writeFileSync(path.join(dir, "icon-192.png"), makePng(192));
fs.writeFileSync(path.join(dir, "icon-96.png"), makePng(96));
console.log("wrote public/icon-192.png and public/icon-96.png");
