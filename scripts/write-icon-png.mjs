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

function paintBars(raw, size, rgb, alphas) {
  const bars = [
    { x: 7 / 32, y: 8 / 32, w: 18 / 32, h: 3.2 / 32, a: alphas[0] },
    { x: 7 / 32, y: 14.4 / 32, w: 18 / 32, h: 3.2 / 32, a: alphas[1] },
    { x: 7 / 32, y: 20.8 / 32, w: 12 / 32, h: 3.2 / 32, a: alphas[2] },
  ];
  const br = Math.max(1, Math.round(size * (1 / 32)));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
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
          raw[i] = rgb[0];
          raw[i + 1] = rgb[1];
          raw[i + 2] = rgb[2];
          raw[i + 3] = bar.a;
        }
      }
    }
  }
}

function makePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const radius = Math.round(size * (7 / 32));
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
      raw[i] = 0xc4;
      raw[i + 1] = 0x1e;
      raw[i + 2] = 0x3a;
      raw[i + 3] = 255;
    }
  }
  paintBars(raw, size, [255, 255, 255], [255, 217, 255]);
  return encodePng(raw, size);
}

/** Badge Android : blanc sur transparent (sinon le logo couleur devient un carré blanc). */
function makeBadge(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) raw[y * (size * 4 + 1)] = 0;
  paintBars(raw, size, [255, 255, 255], [255, 255, 255]);
  return encodePng(raw, size);
}

function fillBg(raw, size, rgb = [0xc4, 0x1e, 0x3a]) {
  const radius = Math.round(size * (7 / 32));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      if (!inRoundRect(x, y, size, radius)) {
        raw[i] = raw[i + 1] = raw[i + 2] = raw[i + 3] = 0;
        continue;
      }
      raw[i] = rgb[0];
      raw[i + 1] = rgb[1];
      raw[i + 2] = rgb[2];
      raw[i + 3] = 255;
    }
  }
}

function setPx(raw, size, x, y, rgb = [255, 255, 255], a = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = y * (size * 4 + 1) + 1 + x * 4;
  raw[i] = rgb[0];
  raw[i + 1] = rgb[1];
  raw[i + 2] = rgb[2];
  raw[i + 3] = a;
}

function fillCircle(raw, size, cx, cy, r, rgb) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) setPx(raw, size, x, y, rgb);
    }
  }
}

function strokeCircle(raw, size, cx, cy, r, w, rgb) {
  const outer = (r + w / 2) ** 2;
  const inner = Math.max(0, r - w / 2) ** 2;
  for (let y = Math.floor(cy - r - w); y <= Math.ceil(cy + r + w); y++) {
    for (let x = Math.floor(cx - r - w); x <= Math.ceil(cx + r + w); x++) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= outer && d >= inner) setPx(raw, size, x, y, rgb);
    }
  }
}

function fillRect(raw, size, x0, y0, w, h, rgb, r = 0) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (r && !inBar(x, y, size, 0, 0, w, h, r)) continue;
      setPx(raw, size, x0 + x, y0 + y, rgb);
    }
  }
}

function strokeLine(raw, size, x0, y0, x1, y1, w, rgb) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(raw, size, x0 + dx * t, y0 + dy * t, w / 2, rgb);
  }
}

function makeNotify(size, draw) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  fillBg(raw, size);
  draw(raw, size);
  return encodePng(raw, size);
}

function drawCart(raw, size) {
  const w = [255, 255, 255];
  const s = size;
  fillRect(raw, s, s * 0.22, s * 0.34, s * 0.52, s * 0.34, w, Math.round(s * 0.04));
  fillRect(raw, s, s * 0.18, s * 0.28, s * 0.16, s * 0.07, w, Math.round(s * 0.02));
  strokeLine(raw, s, s * 0.22, s * 0.31, s * 0.34, s * 0.31, s * 0.045, w);
  fillCircle(raw, s, s * 0.36, s * 0.78, s * 0.055, w);
  fillCircle(raw, s, s * 0.64, s * 0.78, s * 0.055, w);
}

function drawCheck(raw, size) {
  const w = [255, 255, 255];
  strokeCircle(raw, size, size * 0.5, size * 0.5, size * 0.28, size * 0.055, w);
  strokeLine(raw, size, size * 0.32, size * 0.52, size * 0.46, size * 0.66, size * 0.07, w);
  strokeLine(raw, size, size * 0.46, size * 0.66, size * 0.7, size * 0.36, size * 0.07, w);
}

function drawBike(raw, size) {
  const w = [255, 255, 255];
  strokeCircle(raw, size, size * 0.3, size * 0.64, size * 0.14, size * 0.05, w);
  strokeCircle(raw, size, size * 0.7, size * 0.64, size * 0.14, size * 0.05, w);
  strokeLine(raw, size, size * 0.3, size * 0.64, size * 0.48, size * 0.4, size * 0.055, w);
  strokeLine(raw, size, size * 0.48, size * 0.4, size * 0.7, size * 0.64, size * 0.055, w);
  strokeLine(raw, size, size * 0.42, size * 0.64, size * 0.58, size * 0.64, size * 0.05, w);
  strokeLine(raw, size, size * 0.48, size * 0.4, size * 0.48, size * 0.3, size * 0.05, w);
  fillRect(raw, size, size * 0.4, size * 0.24, size * 0.2, size * 0.06, w, 2);
}

function drawWarn(raw, size) {
  const w = [255, 255, 255];
  const cx = size * 0.5;
  strokeLine(raw, size, cx, size * 0.22, size * 0.78, size * 0.74, size * 0.06, w);
  strokeLine(raw, size, size * 0.78, size * 0.74, size * 0.22, size * 0.74, size * 0.06, w);
  strokeLine(raw, size, size * 0.22, size * 0.74, cx, size * 0.22, size * 0.06, w);
  fillRect(raw, size, cx - size * 0.03, size * 0.4, size * 0.06, size * 0.18, w, 2);
  fillCircle(raw, size, cx, size * 0.64, size * 0.035, w);
}

function drawBox(raw, size) {
  const w = [255, 255, 255];
  const x = size * 0.24;
  const y = size * 0.3;
  const bw = size * 0.52;
  const bh = size * 0.42;
  strokeLine(raw, size, x, y, x + bw, y, size * 0.055, w);
  strokeLine(raw, size, x + bw, y, x + bw, y + bh, size * 0.055, w);
  strokeLine(raw, size, x + bw, y + bh, x, y + bh, size * 0.055, w);
  strokeLine(raw, size, x, y + bh, x, y, size * 0.055, w);
  strokeLine(raw, size, x, y + bh * 0.38, x + bw, y + bh * 0.38, size * 0.05, w);
  strokeLine(raw, size, x + bw / 2, y, x + bw / 2, y + bh * 0.38, size * 0.05, w);
}

function drawEdit(raw, size) {
  const w = [255, 255, 255];
  strokeLine(raw, size, size * 0.3, size * 0.7, size * 0.68, size * 0.32, size * 0.07, w);
  fillRect(raw, size, size * 0.64, size * 0.22, size * 0.12, size * 0.12, w, 2);
  strokeLine(raw, size, size * 0.26, size * 0.78, size * 0.42, size * 0.78, size * 0.045, w);
}

function encodePng(raw, size) {
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

function makeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map((png) => {
    const entry = Buffer.alloc(16);
    entry[0] = png.size >= 256 ? 0 : png.size;
    entry[1] = png.size >= 256 ? 0 : png.size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const dir = path.resolve(process.cwd(), "public");
const png16 = makePng(16);
const png32 = makePng(32);
const png48 = makePng(48);
fs.writeFileSync(path.join(dir, "icon-192.png"), makePng(192));
fs.writeFileSync(path.join(dir, "icon-96.png"), makePng(96));
fs.writeFileSync(path.join(dir, "badge-96.png"), makeBadge(96));
fs.writeFileSync(path.join(dir, "favicon.ico"), makeIco([
  { size: 16, data: png16 },
  { size: 32, data: png32 },
  { size: 48, data: png48 },
]));
const notifyDir = path.join(dir, "notify");
fs.mkdirSync(notifyDir, { recursive: true });
const glyphs = {
  cart: drawCart,
  check: drawCheck,
  bike: drawBike,
  warn: drawWarn,
  box: drawBox,
  edit: drawEdit,
};
for (const [name, draw] of Object.entries(glyphs)) {
  fs.writeFileSync(path.join(notifyDir, `${name}.png`), makeNotify(192, draw));
}
console.log("wrote icons, badge and public/notify/{cart,check,bike,warn,box,edit}.png");
