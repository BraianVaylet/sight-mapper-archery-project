import type { Page } from '@playwright/test';
import axe from 'axe-core';

export type Finding = { id: string; impact: string; help: string; targets: string[] };

/** axe-core (WCAG 2.0–2.2 A and AA) on the page as it is: only the serious and critical findings. */
export async function axeFindings(page: Page): Promise<Finding[]> {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const runner = (window as unknown as { axe: typeof axe }).axe;
    const result = await runner.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    });
    return result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({
        id: v.id,
        impact: v.impact ?? '',
        help: v.help,
        targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
      }));
  });
}

/** Nothing sticks out sideways: no horizontal scroll, which on a phone means a page that slides. */
export async function overflow(page: Page): Promise<{ scrollWidth: number; width: number } | null> {
  return page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const width = document.documentElement.clientWidth;
    return scrollWidth > width + 1 ? { scrollWidth, width } : null;
  });
}
