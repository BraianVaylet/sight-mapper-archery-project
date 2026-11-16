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

/** Tokens that do not change with the theme: only the dark (default) block declares them. */
const THEME_INDEPENDENT = ['size-touch', 'size-touch-lg', 'grid-step', 'grid-step-major'];
/** Tokens that are not a single colour (shadows carry a colour inside a box-shadow value). */
const NOT_A_COLOUR = [...THEME_INDEPENDENT, 'shadow-key', 'shadow-panel'];

const SURFACES = ['bg', 'surface', 'surface-raised', 'surface-sunken'];

describe('theme definitions', () => {
  it('defines the same tokens in dark and light', () => {
    const themed = Object.keys(dark).filter((name) => !THEME_INDEPENDENT.includes(name));
    expect(Object.keys(light).sort()).toEqual(themed.sort());
  });

  it('defines the system theme exactly as light, so "system" follows the OS', () => {
    expect(system).toEqual(light);
  });

  it('keeps the blueprint palette of the dark theme (DESIGN-SYSTEM §2.1)', () => {
    expect(dark['bg']).toBe('#0b1b45');
    expect(dark['accent']).toBe('#ffcc00');
    expect(dark['text']).toBe('#f4f6fc');
    expect(dark['info']).toBe('#6ec6e6');
  });

  it('turns the accent navy with yellow ink in the light theme', () => {
    expect(light['accent']).toBe('#10286b');
    expect(light['accent-ink']).toBe('#ffcc00');
  });

  it('sets the tappable minimum to 48 px and the fixed primary action to 56 px', () => {
    expect(dark['size-touch']).toBe('48px');
    expect(dark['size-touch-lg']).toBe('56px');
  });

  it('steps the blueprint grid every 8 px, with a major line every 40 px', () => {
    expect(dark['grid-step']).toBe('8px');
    expect(dark['grid-step-major']).toBe('40px');
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
] as const)('%s theme contrast (outdoors: AAA main text)', (_name, theme) => {
  it.each(SURFACES)('main text reads on %s (≥ 7:1)', (surface) => {
    expect(contrast(colour(theme, 'text'), colour(theme, surface))).toBeGreaterThanOrEqual(7);
  });

  it.each(SURFACES)('muted text and the status colours read on %s (≥ 4.5:1)', (surface) => {
    for (const text of ['text-muted', 'mark', 'info', 'danger', 'warning']) {
      expect(
        contrast(colour(theme, text), colour(theme, surface)),
        `${text} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('puts the ink on the accent button at ≥ 7:1', () => {
    expect(contrast(colour(theme, 'accent-ink'), colour(theme, 'accent'))).toBeGreaterThanOrEqual(
      7,
    );
  });

  it.each(SURFACES)(
    'borders and the focus ring stand out from %s (≥ 3:1, WCAG 1.4.11)',
    (surface) => {
      for (const edge of ['border', 'focus']) {
        expect(
          contrast(colour(theme, edge), colour(theme, surface)),
          `${edge} on ${surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it('draws the key edge of the primary button visibly on the page', () => {
    expect(contrast(colour(theme, 'accent-edge'), colour(theme, 'bg'))).toBeGreaterThanOrEqual(3);
  });

  it('keeps the blueprint grid decorative: visible, never competing (1.1–1.5:1 on bg)', () => {
    for (const line of ['grid', 'grid-major']) {
      const ratio = contrast(colour(theme, line), colour(theme, 'bg'));
      expect(ratio, line).toBeGreaterThanOrEqual(1.1);
      expect(ratio, line).toBeLessThanOrEqual(1.5);
    }
  });

  it('builds the hard shadows from the theme colours, with no blur', () => {
    expect(theme['shadow-key']).toBe(`0 3px 0 0 ${colour(theme, 'accent-edge')}`);
    expect(theme['shadow-panel']).toMatch(/^4px 4px 0 0 #[0-9a-f]{6}$/);
  });
});

describe('dark theme: the accent is also text (readings, measured marks)', () => {
  it.each(SURFACES)('accent reads on %s (≥ 4.5:1)', (surface) => {
    expect(contrast(colour(dark, 'accent'), colour(dark, surface))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('what was measured, as ink (`mark`)', () => {
  it('is the yellow of the design in the dark theme', () => {
    expect(dark['mark']).toBe(dark['accent']);
  });

  it('is a dark gold in the light theme, where yellow on paper cannot be read', () => {
    expect(light['mark']).toBe('#6b4f00');
    expect(contrast(light['accent-ink'] ?? '', colour(light, 'bg'))).toBeLessThan(3);
  });
});

describe('Tailwind mapping', () => {
  it('maps every token to a utility', () => {
    const mapped = Object.keys(dark).filter((name) => !THEME_INDEPENDENT.includes(name));
    for (const name of mapped) {
      expect(themeCss, name).toContain(`var(--sm-${name})`);
    }
  });

  it('only treats real colours as colours', () => {
    const colours = Object.keys(dark).filter((name) => !NOT_A_COLOUR.includes(name));
    for (const name of colours) colour(dark, name);
  });

  it('uses inline mapping so switching data-theme needs no rebuild', () => {
    expect(themeCss).toContain('@theme inline');
  });

  it('loads no fonts from other hosts (ADR-012: own woff2, precached)', () => {
    expect(themeCss).not.toMatch(/@import url|fonts\.googleapis|fonts\.gstatic/);
  });
});
