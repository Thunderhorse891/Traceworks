#!/usr/bin/env node
/**
 * gen-icons.mjs — Pure Node.js PNG icon generator for TraceWorks PWA
 * No external dependencies. Uses node:zlib for deflate compression.
 * Run: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/icons');

// ── CRC32 (PNG requires CRC32 over chunk type + data) ──────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeU32BE(buf, offset, val) {
  buf[offset]     = (val >>> 24) & 0xFF;
  buf[offset + 1] = (val >>> 16) & 0xFF;
  buf[offset + 2] = (val >>>  8) & 0xFF;
  buf[offset + 3] =  val         & 0xFF;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const dataBuf = Buffer.from(data);
  const lenBuf  = Buffer.alloc(4);
  const crcBuf  = Buffer.alloc(4);
  writeU32BE(lenBuf, 0, dataBuf.length);
  writeU32BE(crcBuf, 0, crc32(Buffer.concat([typeBuf, dataBuf])));
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

function createPNG(width, height, renderPixel) {
  // IHDR — 13 bytes
  const ihdr = Buffer.alloc(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB truecolor
  // ihdr[10-12] = 0: deflate, adaptive filter, no interlace

  // Scanlines: each row = [filter_byte=0] + [R,G,B × width]
  const stride  = 1 + width * 3;
  const rawData = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    rawData[y * stride] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = renderPixel(x, y);
      const base = y * stride + 1 + x * 3;
      rawData[base]     = r;
      rawData[base + 1] = g;
      rawData[base + 2] = b;
    }
  }

  // deflateSync produces zlib format (RFC 1950) which is exactly what PNG IDAT needs
  const idat = deflateSync(rawData, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Color palette ──────────────────────────────────────────────────────────
const BG   = [9,   9,  15];   // #09090f — deep void
const GOLD = [201, 168, 76];  // #c9a84c — gold accent
const MID  = [13,  20,  36];  // #0d1424 — slightly lighter bg for gradient feel

// ── Distance from point to line segment ────────────────────────────────────
function ptSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ── Icon renderer ──────────────────────────────────────────────────────────
function renderIcon(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const s  = size / 192; // scale relative to 192 design

  // Subtle radial gradient background: lighter center
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) / (size * 0.7);
  if (dist < 1) {
    const blend = 1 - dist;
    // Interpolate BG ↔ MID
    const r = Math.round(BG[0] + (MID[0] - BG[0]) * blend * 0.4);
    const g = Math.round(BG[1] + (MID[1] - BG[1]) * blend * 0.4);
    const b = Math.round(BG[2] + (MID[2] - BG[2]) * blend * 0.4);
    // Store as temp bg for this pixel — we'll override with gold if needed
    var pixelBG = [r, g, b];
  } else {
    var pixelBG = BG;
  }

  // Gold top accent bar (full width, ~4% of size)
  const barH = Math.max(3, Math.round(size * 0.036));
  if (y < barH) return GOLD;

  // Letter geometry (scaled from 192-base design)
  const lH   = Math.round(74 * s);           // letter height
  const lW   = Math.round(42 * s);           // letter width
  const sw   = Math.max(4, Math.round(9 * s)); // stroke width
  const gap  = Math.round(14 * s);           // gap between T and W
  const totalW = lW * 2 + gap;
  const lX  = Math.round(cx - totalW / 2);
  const lY  = Math.round(cy - lH / 2 - size * 0.02); // slight vertical offset up

  // ── T LETTER ──────────────────────────────────────────────────────────────
  const tX = lX;
  const tY = lY;
  // T horizontal top bar
  if (x >= tX && x < tX + lW && y >= tY && y < tY + sw) return GOLD;
  // T vertical bar (centered)
  const tvX = Math.round(tX + (lW - sw) / 2);
  if (x >= tvX && x < tvX + sw && y >= tY && y < tY + lH) return GOLD;

  // ── W LETTER ──────────────────────────────────────────────────────────────
  const wX = lX + lW + gap;
  const wY = lY;
  if (x >= wX && x < wX + lW && y >= wY && y < wY + lH) {
    const px = x + 0.5; // center of pixel
    const py = y + 0.5;
    const hs = sw / 2;  // half-stroke threshold
    // 4 diagonal segments of W (top-open shape)
    const d1 = ptSegDist(px, py,  wX,              wY,         wX + lW * 0.25, wY + lH);
    const d2 = ptSegDist(px, py,  wX + lW * 0.25,  wY + lH,    wX + lW * 0.5,  wY + lH * 0.38);
    const d3 = ptSegDist(px, py,  wX + lW * 0.5,   wY + lH * 0.38, wX + lW * 0.75, wY + lH);
    const d4 = ptSegDist(px, py,  wX + lW * 0.75,  wY + lH,    wX + lW,        wY);
    if (d1 <= hs || d2 <= hs || d3 <= hs || d4 <= hs) return GOLD;
  }

  // Gold bottom accent bar (2px thin)
  const botH = Math.max(2, Math.round(size * 0.016));
  if (y >= size - botH) return GOLD;

  return pixelBG;
}

// ── Generate icons ─────────────────────────────────────────────────────────
for (const size of [192, 512]) {
  const png = createPNG(size, size, (x, y) => renderIcon(x, y, size));
  const outPath = join(OUT, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ icon-${size}.png — ${(png.length / 1024).toFixed(1)} KB`);
}
console.log('Done.');
