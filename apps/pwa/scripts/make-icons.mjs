// Draws the app icon (a sight scale with its marker) and writes the PNGs the manifest needs.
// No dependencies: `node apps/pwa/scripts/make-icons.mjs`. The art is inside the 80% safe zone,
// so the same file serves as `any` and `maskable`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));
const NAVY = [0x10, 0x28, 0x6b];
const WHITE = [0xff, 0xff, 0xff];
const YELLOW = [0xff, 0xcc, 0x00];
const SAMPLES = 3; // per axis, for smooth edges

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** Colour of the icon at (x, y) in the unit square. */
function colourAt(x, y) {
  // marker: a yellow bar pointing at the scale, with a round head
  if (inRect(x, y, 0.2, 0.535, 0.4, 0.585)) return YELLOW;
  if ((x - 0.4) ** 2 + (y - 0.56) ** 2 <= 0.07 ** 2) return YELLOW;
  // scale: a vertical bar with a tick every step, longer every fifth
  if (inRect(x, y, 0.46, 0.2, 0.495, 0.8)) return WHITE;
  for (let i = 0; i <= 10; i++) {
    const ty = 0.2 + i * 0.06;
    const length = i % 5 === 0 ? 0.2 : 0.11;
    if (inRect(x, y, 0.495, ty - 0.008, 0.495 + length, ty + 0.008)) return WHITE;
  }
  return NAVY;
}

function render(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colourAt(
            (px + (sx + 0.5) / SAMPLES) / size,
            (py + (sy + 0.5) / SAMPLES) / size,
          );
          for (let k = 0; k < 3; k++) sum[k] += c[k];
        }
      }
      for (let k = 0; k < 3; k++) {
        raw[py * (size * 3 + 1) + 1 + px * 3 + k] = Math.round(sum[k] / SAMPLES ** 2);
      }
    }
  }
  return raw;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
]) {
  writeFileSync(`${OUT}${name}`, png(size));
}
