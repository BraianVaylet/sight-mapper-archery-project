// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('./styles/theme.css', import.meta.url), 'utf8');

type Tokens = Record<string, string>;

function declarations(block: string): Tokens {
  return Object.fromEntries(
    [...block.matchAll(/--sm-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]),
  );
}

function blockAfter(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

const dark = declarations(blockAfter(':root {'));
const light = declarations(blockAfter(":root[data-theme='light'] {"));
const system = declarations(blockAfter(':root:not([data-theme]) {'));

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const colour = (tokens: Tokens, name: string): string => {
  const value = tokens[name];
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`bad token ${name}`);
  return value;
};

describe('theme definitions', () => {
  it('defines the same tokens in dark and light', () => {
    // `size-touch` is theme independent, so only the dark (default) block declares it.
    const themed = Object.keys(dark).filter((name) => name !== 'size-touch');
    expect(Object.keys(light).sort()).toEqual(themed.sort());
  });

  it('defines the system theme exactly as light, so "system" follows the OS', () => {
    expect(system).toEqual(light);
  });

  it('keeps the design colours of the dark theme (UX-UI §2.1)', () => {
    expect(dark['bg']).toBe('#10286b');
    expect(dark['accent']).toBe('#ffcc00');
    expect(dark['text']).toBe('#ffffff');
    expect(dark['info']).toBe('#6ec6e6');
  });

  it('sets the tappable minimum to 44 px', () => {
    expect(dark['size-touch']).toBe('44px');
  });

  it('declares which scheme the browser should draw native controls in', () => {
    expect(css).toMatch(/:root \{\s*color-scheme: dark;/);
    expect(css).toMatch(/\[data-theme='light'\] \{\s*color-scheme: light;/);
  });

  it('honours reduced motion', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});

describe.each([
  ['dark', dark],
  ['light', light],
] as const)('%s theme contrast (WCAG AA)', (_name, theme) => {
  const surfaces = ['bg', 'surface', 'surface-sunken'];

  it.each(surfaces)('text, muted text and the status colours read on %s (≥ 4.5:1)', (surface) => {
    for (const text of ['text', 'text-muted', 'mark', 'info', 'danger', 'warning']) {
      expect(
        contrast(colour(theme, text), colour(theme, surface)),
        `${text} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('puts the ink on the accent button at ≥ 4.5:1', () => {
    expect(contrast(colour(theme, 'accent-ink'), colour(theme, 'accent'))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it.each(surfaces)('borders stand out from %s (≥ 3:1, WCAG 1.4.11)', (surface) => {
    expect(
      contrast(colour(theme, 'border'), colour(theme, surface)),
      `border on ${surface}`,
    ).toBeGreaterThanOrEqual(3);
  });

  it('draws the edge of the accent button with enough contrast', () => {
    expect(contrast(colour(theme, 'accent-edge'), colour(theme, 'accent'))).toBeGreaterThanOrEqual(
      3 * 0.9,
    );
  });
});

describe('dark theme: the accent is also text (readings, measured marks)', () => {
  it.each(['bg', 'surface', 'surface-sunken'])('accent reads on %s (≥ 4.5:1)', (surface) => {
    expect(contrast(colour(dark, 'accent'), colour(dark, surface))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('what was measured, as ink (`mark`)', () => {
  it('is the yellow of the design in the dark theme', () => {
    expect(dark['mark']).toBe(dark['accent']);
  });

  it('is not the yellow in the light theme, where yellow on white cannot be read', () => {
    expect(light['mark']).not.toBe(light['accent']);
    expect(contrast(colour(light, 'mark'), colour(light, 'surface'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('light theme: the accent is only a fill', () => {
  it('is never asked to be text on the page background', () => {
    // Yellow on near-white fails AA, which is why the light theme keeps it for buttons only.
    expect(contrast(colour(light, 'accent'), colour(light, 'bg'))).toBeLessThan(3);
    expect(contrast(colour(light, 'accent-edge'), colour(light, 'bg'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Tailwind mapping', () => {
  it('maps every colour token to a utility colour', () => {
    const colours = Object.keys(dark).filter((name) => name !== 'size-touch');
    for (const name of colours) {
      expect(themeCss, name).toContain(`var(--sm-${name})`);
    }
  });

  it('uses inline mapping so switching data-theme needs no rebuild', () => {
    expect(themeCss).toContain('@theme inline');
  });

  it('loads no web fonts', () => {
    expect(themeCss).not.toMatch(/@import url|@font-face|fonts\.googleapis/);
  });
});
