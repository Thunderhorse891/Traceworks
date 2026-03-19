import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const iconsDir = path.join(publicDir, 'icons');
const screenshotsDir = path.join(publicDir, 'screenshots');

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(start, end, t) {
  return [
    Math.round(mix(start[0], end[0], t)),
    Math.round(mix(start[1], end[1], t)),
    Math.round(mix(start[2], end[2], t)),
    Math.round(mix(start[3] ?? 255, end[3] ?? 255, t)),
  ];
}

function createCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4),
  };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 4;
  canvas.data[index] = color[0];
  canvas.data[index + 1] = color[1];
  canvas.data[index + 2] = color[2];
  canvas.data[index + 3] = color[3] ?? 255;
}

function fillRect(canvas, x, y, width, height, color) {
  const startX = clamp(Math.round(x), 0, canvas.width);
  const startY = clamp(Math.round(y), 0, canvas.height);
  const endX = clamp(Math.round(x + width), 0, canvas.width);
  const endY = clamp(Math.round(y + height), 0, canvas.height);

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      setPixel(canvas, px, py, color);
    }
  }
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  const startX = Math.round(x);
  const startY = Math.round(y);
  const endX = Math.round(x + width);
  const endY = Math.round(y + height);
  const r = Math.max(0, Math.round(radius));

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const dx = px < startX + r ? startX + r - px : px > endX - r - 1 ? px - (endX - r - 1) : 0;
      const dy = py < startY + r ? startY + r - py : py > endY - r - 1 ? py - (endY - r - 1) : 0;
      if ((dx * dx) + (dy * dy) <= r * r) {
        setPixel(canvas, px, py, color);
      }
    }
  }
}

function drawCircle(canvas, centerX, centerY, radius, color) {
  const r = Math.round(radius);
  for (let py = Math.round(centerY - r); py <= Math.round(centerY + r); py += 1) {
    for (let px = Math.round(centerX - r); px <= Math.round(centerX + r); px += 1) {
      const dx = px - centerX;
      const dy = py - centerY;
      if ((dx * dx) + (dy * dy) <= (radius * radius)) {
        setPixel(canvas, px, py, color);
      }
    }
  }
}

function drawLine(canvas, x1, y1, x2, y2, thickness, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  const radius = thickness / 2;
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    drawCircle(canvas, mix(x1, x2, t), mix(y1, y2, t), radius, color);
  }
}

function paintBackground(canvas, topColor, bottomColor) {
  const width = canvas.width;
  const height = canvas.height;
  const spotlightX = width * 0.22;
  const spotlightY = height * 0.16;
  const spotlightRadius = Math.max(width, height) * 0.72;

  for (let y = 0; y < height; y += 1) {
    const yMix = y / Math.max(1, height - 1);
    const rowBase = mixColor(topColor, bottomColor, yMix);

    for (let x = 0; x < width; x += 1) {
      const dx = x - spotlightX;
      const dy = y - spotlightY;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      const glow = clamp(1 - (distance / spotlightRadius), 0, 1);
      const goldBoost = glow * 24;
      const blueBoost = (1 - yMix) * 8;

      setPixel(canvas, x, y, [
        clamp(rowBase[0] + goldBoost, 0, 255),
        clamp(rowBase[1] + goldBoost + blueBoost, 0, 255),
        clamp(rowBase[2] + (glow * 18), 0, 255),
        255,
      ]);
    }
  }
}

function paintFrame(canvas, inset, color) {
  fillRoundedRect(canvas, inset, inset, canvas.width - (inset * 2), canvas.height - (inset * 2), inset * 1.6, color);
  fillRoundedRect(canvas, inset * 1.75, inset * 1.75, canvas.width - (inset * 3.5), canvas.height - (inset * 3.5), inset * 1.2, [6, 12, 20, 255]);
}

function paintMonogram(canvas, scale = 1) {
  const gold = [223, 184, 58, 255];
  const goldSoft = [245, 216, 122, 255];
  const width = canvas.width;
  const height = canvas.height;
  const thick = Math.max(8, Math.round(Math.min(width, height) * 0.08 * scale));
  const left = width * 0.24;
  const right = width * 0.76;
  const center = width * 0.5;
  const top = height * 0.22;
  const mid = height * 0.44;
  const lower = height * 0.78;
  const innerLeft = width * 0.38;
  const innerRight = width * 0.62;

  drawLine(canvas, left, top, right, top, thick, goldSoft);
  drawLine(canvas, center, top, center, mid, thick, gold);
  drawLine(canvas, left, mid, innerLeft, lower, thick, gold);
  drawLine(canvas, innerLeft, lower, center, mid + (height * 0.08), thick, goldSoft);
  drawLine(canvas, center, mid + (height * 0.08), innerRight, lower, thick, goldSoft);
  drawLine(canvas, innerRight, lower, right, mid, thick, gold);
}

function paintIcon(canvas) {
  paintBackground(canvas, [7, 16, 27, 255], [3, 8, 15, 255]);
  paintFrame(canvas, Math.round(canvas.width * 0.06), [212, 168, 39, 255]);
  paintMonogram(canvas, 1);
  fillRoundedRect(
    canvas,
    canvas.width * 0.16,
    canvas.height * 0.16,
    canvas.width * 0.18,
    canvas.height * 0.035,
    canvas.width * 0.01,
    [80, 121, 183, 255]
  );
}

function paintScreenshot(canvas, mobile = false) {
  paintBackground(canvas, [6, 16, 30, 255], [5, 10, 18, 255]);

  const pad = mobile ? canvas.width * 0.06 : canvas.width * 0.05;
  const shellRadius = mobile ? 24 : 28;
  fillRoundedRect(canvas, pad, pad, canvas.width - (pad * 2), canvas.height - (pad * 2), shellRadius, [7, 14, 24, 245]);
  fillRect(canvas, pad, pad + 56, canvas.width - (pad * 2), 1, [34, 48, 70, 255]);
  fillRect(canvas, pad + 26, pad + 20, mobile ? 120 : 170, 14, [242, 244, 248, 255]);
  fillRoundedRect(canvas, canvas.width - pad - 148, pad + 14, 122, 26, 13, [212, 168, 39, 255]);
  fillRoundedRect(canvas, pad + 26, pad + 90, mobile ? canvas.width - (pad * 2) - 52 : canvas.width * 0.56, mobile ? 180 : 220, 20, [11, 20, 32, 255]);

  const sideX = mobile ? pad + 26 : (canvas.width * 0.67);
  const sideWidth = mobile ? canvas.width - (pad * 2) - 52 : canvas.width * 0.23;
  const sideY = mobile ? pad + 292 : pad + 90;
  fillRoundedRect(canvas, sideX, sideY, sideWidth, mobile ? 116 : 220, 18, [14, 28, 46, 255]);

  fillRoundedRect(canvas, pad + 26, pad + 330, mobile ? canvas.width - (pad * 2) - 52 : canvas.width - (pad * 2) - 52, mobile ? 160 : 250, 18, [11, 20, 32, 255]);

  const cardWidth = mobile ? (canvas.width - (pad * 2) - 78) : ((canvas.width - (pad * 2) - 82) / 3);
  const cardY = mobile ? pad + 520 : pad + 612;
  const columns = mobile ? 1 : 3;
  for (let i = 0; i < columns; i += 1) {
    const cardX = pad + 26 + (i * (cardWidth + 15));
    fillRoundedRect(canvas, cardX, cardY, cardWidth, mobile ? 100 : 120, 16, [15, 28, 44, 255]);
    fillRoundedRect(canvas, cardX + 18, cardY + 18, cardWidth * 0.44, 14, 7, [212, 168, 39, 255]);
    fillRect(canvas, cardX + 18, cardY + 46, cardWidth - 36, 10, [232, 237, 247, 255]);
    fillRect(canvas, cardX + 18, cardY + 64, cardWidth - 54, 8, [128, 147, 175, 255]);
  }

  fillRoundedRect(canvas, pad + 54, pad + 126, mobile ? 162 : 240, 12, 6, [212, 168, 39, 255]);
  fillRect(canvas, pad + 54, pad + 152, mobile ? canvas.width * 0.48 : canvas.width * 0.34, 12, [235, 241, 252, 255]);
  fillRect(canvas, pad + 54, pad + 178, mobile ? canvas.width * 0.36 : canvas.width * 0.26, 10, [136, 153, 179, 255]);
}

function encodePng(canvas) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  const pixels = Buffer.from(canvas.data);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowOffset = y * ((canvas.width * 4) + 1);
    raw[rowOffset] = 0;
    pixels.copy(raw, rowOffset + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function writePng(filePath, width, height, painter) {
  const canvas = createCanvas(width, height);
  painter(canvas);
  await writeFile(filePath, encodePng(canvas));
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });

  await writePng(path.join(iconsDir, 'icon-192.png'), 192, 192, paintIcon);
  await writePng(path.join(iconsDir, 'icon-512.png'), 512, 512, paintIcon);
  await writePng(path.join(screenshotsDir, 'install-desktop.png'), 1280, 720, (canvas) => paintScreenshot(canvas, false));
  await writePng(path.join(screenshotsDir, 'install-mobile.png'), 540, 720, (canvas) => paintScreenshot(canvas, true));
}

await main();
