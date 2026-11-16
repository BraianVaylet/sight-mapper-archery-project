import type { Page } from '@playwright/test';

export type ContrastProblem = {
  readonly text: string;
  readonly ratio: number;
  readonly needed: number;
  readonly color: string;
  readonly background: string;
};

/**
 * WCAG 2.x contrast of every piece of text the archer can read on the screen, against what is
 * really behind it: the first opaque background up the tree, with translucent layers and the
 * opacity of the ancestors composed on top. Disabled controls are left out (WCAG 1.4.3 exempts
 * inactive components); large text (24 px, or 18.66 px bold) needs 3:1, the rest 4.5:1.
 *
 * It runs inside the page and needs no library: the same arithmetic as `tokens.test.ts`, applied
 * to the colours the browser actually computed.
 */
export async function contrastProblems(page: Page): Promise<ContrastProblem[]> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (m === null) return [0, 0, 0, 0];
      const parts = (m[1] ?? '')
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3];
      return [
        top[0] * a + bottom[0] * (1 - a),
        top[1] * a + bottom[1] * (1 - a),
        top[2] * a + bottom[2] * (1 - a),
        1,
      ];
    };
    const luminance = ([r, g, b]: Rgba) => {
      const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const hex = ([r, g, b]: Rgba) =>
      `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

    /** The colour behind an element: translucent layers composed down to the page. */
    const backgroundOf = (element: Element): Rgba => {
      const layers: Rgba[] = [];
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg[3] > 0) {
          layers.push(bg);
          if (bg[3] >= 1) break;
        }
      }
      let result: Rgba = [255, 255, 255, 1];
      for (const layer of layers.reverse()) result = over(layer, result);
      return result;
    };
    const opacityOf = (element: Element) => {
      let o = 1;
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        o *= Number(getComputedStyle(node).opacity);
      }
      return o;
    };
    const inactive = (element: Element) =>
      element.closest('[disabled], [aria-disabled="true"], [aria-hidden="true"], .sr-only') !==
      null;

    const problems: ContrastProblem[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      const content = (text.textContent ?? '').trim();
      const element = text.parentElement;
      if (content === '' || element === null || seen.has(element) || inactive(element)) continue;
      seen.add(element);
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        box.width === 0 ||
        box.height === 0
      ) {
        continue;
      }
      // SVG text paints with `fill`; everything else with `color`.
      const paint = element instanceof SVGElement ? style.fill : style.color;
      const fg = parse(paint);
      const bg = backgroundOf(element);
      const shown = over([fg[0], fg[1], fg[2], fg[3] * opacityOf(element)], bg);
      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const needed = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      const r = ratio(shown, bg);
      if (r < needed) {
        problems.push({
          text: content.slice(0, 60),
          ratio: Math.round(r * 100) / 100,
          needed,
          color: hex(shown),
          background: hex(bg),
        });
      }
    }
    // Graphics that carry meaning (WCAG 1.4.11, 3:1): the dots, diamonds and lines of the ruler and
    // the curve that tell measured from calculated. Their paint is read where it is drawn.
    const graphics = document.querySelectorAll(
      '[data-mark] circle:not([fill="transparent"]), [data-mark] line, [data-mark] path, [data-point] circle:not([fill="transparent"]), [data-point] path, [data-line]',
    );
    for (const shape of graphics) {
      if (inactive(shape)) continue;
      const style = getComputedStyle(shape);
      const bg = backgroundOf(shape);
      const visible = (paint: string) => paint !== 'none' && parse(paint)[3] > 0;
      const ratioOf = (paint: string) => ratio(over(parse(paint), bg), bg);
      // What makes the shape seen: a line by its stroke (its `fill` is never drawn); a shape with a
      // stroke that stands out by that stroke (the hollow diamond is filled with the page colour);
      // a dot without stroke by its fill.
      const outlined = visible(style.stroke) && ratioOf(style.stroke) >= 3;
      const paints =
        shape.tagName.toLowerCase() === 'line' || outlined
          ? [style.stroke]
          : visible(style.stroke)
            ? [style.stroke, style.fill]
            : [style.fill];
      for (const paint of paints) {
        if (!visible(paint)) continue;
        const shown = over(parse(paint), bg);
        const r = ratio(shown, bg);
        if (r < 3) {
          problems.push({
            text:
              '<' +
              shape.tagName.toLowerCase() +
              ' ' +
              (shape.closest('[data-mark]')?.getAttribute('data-mark') ??
                shape.closest('[data-point]')?.getAttribute('data-point') ??
                shape.getAttribute('data-line') ??
                '') +
              '>',
            ratio: Math.round(r * 100) / 100,
            needed: 3,
            color: hex(shown),
            background: hex(bg),
          });
        }
      }
    }
    return problems;
  });
}
