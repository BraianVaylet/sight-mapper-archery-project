// Draws the app icon and writes the PNGs the manifest needs, plus the SVG of the design system.
// The icon (spec §14, F1-41): the navy tile and the white sight scale, with half a sight in
// yellow — a half ring open toward the scale, its ends on the ends of the scale, and a dot on the
// scale at mid height. No dependencies: `node apps/pwa/scripts/make-icons.mjs`. The art is inside
// the 80% safe zone, so the same file serves as `any` and `maskable`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));
const LOGOS = fileURLToPath(
  new URL('../../../docs/redesign/design-system/assets/Logos/', import.meta.url),
);
const NAVY = [0x10, 0x28, 0x6b];
const WHITE = [0xff, 0xff, 0xff];
const YELLOW = [0xff, 0xcc, 0x00];
const SAMPLES = 3; // per axis, for smooth edges

const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// Geometry in the unit square. The scale keeps the old proportions; everything moves 0.03 right so
// the art is centred and the top long tick still sits inside the safe zone (radius 0.4).
const SCALE = { x0: 0.49, x1: 0.525, top: 0.2, bottom: 0.8 };
const AXIS = (SCALE.x0 + SCALE.x1) / 2; // the line the half sight is centred on
const MID = (SCALE.top + SCALE.bottom) / 2;
const RING = { radius: (SCALE.bottom - SCALE.top) / 2, half: 0.0175 }; // ends on the scale's ends
const DOT = 0.045;
const TICKS = Array.from({ length: 11 }, (_, i) => ({
  y: SCALE.top + i * 0.06,
  length: i % 5 === 0 ? 0.2 : 0.11, // longer every fifth
}));
const TICK_HALF = 0.008;

/** Colour of the icon at (x, y) in the unit square. */
function colourAt(x, y) {
  // the dot sits on the scale, so it goes first
  if ((x - AXIS) ** 2 + (y - MID) ** 2 <= DOT ** 2) return YELLOW;
  // scale: a vertical bar with a tick every step
  if (inRect(x, y, SCALE.x0, SCALE.top, SCALE.x1, SCALE.bottom)) return WHITE;
  for (const tick of TICKS) {
    if (inRect(x, y, SCALE.x1, tick.y - TICK_HALF, SCALE.x1 + tick.length, tick.y + TICK_HALF)) {
      return WHITE;
    }
  }
  // the half ring, to the left of the scale: its ends stop against the bar
  const r = Math.hypot(x - AXIS, y - MID);
  if (x < SCALE.x0 && r >= RING.radius - RING.half && r <= RING.radius + RING.half) return YELLOW;
  return NAVY;
}

const hex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** The same drawing as an SVG (512 units), for the design system and anything that scales. */
function svg() {
  const u = (value) => +(value * 512).toFixed(2);
  const ticks = TICKS.map(
    (t) =>
      `<rect x="${u(SCALE.x1)}" y="${u(t.y - TICK_HALF)}" width="${u(t.length)}" height="${u(2 * TICK_HALF)}"/>`,
  ).join('');
  const arc = `M${u(AXIS)} ${u(SCALE.top)}A${u(RING.radius)} ${u(RING.radius)} 0 0 0 ${u(AXIS)} ${u(SCALE.bottom)}`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Sight Mapper">',
    `<rect width="512" height="512" fill="${hex(NAVY)}"/>`,
    `<clipPath id="left"><rect width="${u(SCALE.x0)}" height="512"/></clipPath>`,
    `<path d="${arc}" fill="none" stroke="${hex(YELLOW)}" stroke-width="${u(2 * RING.half)}" clip-path="url(#left)"/>`,
    `<g fill="${hex(WHITE)}"><rect x="${u(SCALE.x0)}" y="${u(SCALE.top)}" width="${u(SCALE.x1 - SCALE.x0)}" height="${u(SCALE.bottom - SCALE.top)}"/>${ticks}</g>`,
    `<circle cx="${u(AXIS)}" cy="${u(MID)}" r="${u(DOT)}" fill="${hex(YELLOW)}"/>`,
    '</svg>',
    '',
  ].join('\n');
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
writeFileSync(`${LOGOS}sight-mapper-icon-512.png`, png(512));
writeFileSync(`${LOGOS}sight-mapper-icon.svg`, svg());
