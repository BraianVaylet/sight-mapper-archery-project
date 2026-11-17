// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fontsCss = readFileSync(new URL('./styles/fonts.css', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('./styles/theme.css', import.meta.url), 'utf8');

const faces = [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
const field = (face: string, name: string): string =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(face)?.[1]?.trim() ?? '';

describe('own fonts (ADR-012)', () => {
  it('declares the eight faces of the design system', () => {
    const declared = faces.map(
      (face) => `${field(face, 'font-family')} ${field(face, 'font-weight')}`,
    );
    expect(declared.sort()).toEqual(
      [
        "'Chakra Petch' 600",
        "'Chakra Petch' 700",
        "'IBM Plex Mono' 400",
        "'IBM Plex Mono' 500",
        "'IBM Plex Mono' 600",
        "'IBM Plex Sans' 400",
        "'IBM Plex Sans' 500",
        "'IBM Plex Sans' 600",
      ].sort(),
    );
  });

  it.each(faces.map((face) => [field(face, 'src'), face] as const))(
    'serves %s from the package itself, swapping in when ready',
    (src, face) => {
      const url = /url\('([^']+)'\)/.exec(src)?.[1] ?? '';
      expect(url).toMatch(/^\.\.\/fonts\/[\w-]+\.woff2$/);
      expect(existsSync(new URL(url, new URL('./styles/', import.meta.url)))).toBe(true);
      expect(field(face, 'font-display')).toBe('swap');
    },
  );

  it('keeps the OFL license of every family next to the files', () => {
    for (const family of ['chakra-petch', 'ibm-plex-sans', 'ibm-plex-mono']) {
      expect(existsSync(new URL(`./fonts/licenses/${family}-OFL.txt`, import.meta.url))).toBe(true);
    }
  });

  it('never loads a font from another host', () => {
    expect(fontsCss).not.toMatch(/https?:\/\//);
  });

  it('puts each family first in its stack, with a system fallback', () => {
    expect(themeCss).toMatch(/--font-display: 'Chakra Petch', [^;]*sans-serif;/);
    expect(themeCss).toMatch(/--font-ui: 'IBM Plex Sans', [^;]*sans-serif;/);
    expect(themeCss).toMatch(/--font-mono: 'IBM Plex Mono', [^;]*monospace;/);
  });
});
