import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';
import { tourEveryScreen } from './tour.js';

type Finding = { id: string; impact: string; help: string; targets: string[] };

/** axe-core (WCAG 2.0–2.2 A and AA) on the page as it is: only the serious and critical findings. */
async function axeFindings(page: Page): Promise<Finding[]> {
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
async function overflow(page: Page): Promise<{ scrollWidth: number; width: number } | null> {
  return page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const width = document.documentElement.clientWidth;
    return scrollWidth > width + 1 ? { scrollWidth, width } : null;
  });
}

// F1-19: 0 serious axe violations, and no page wider than the screen, on every screen (UX-UI §6–7).
test('every screen: no serious axe violation, nothing wider than the screen', async ({ page }) => {
  test.setTimeout(150_000);
  const violations: Record<string, Finding[]> = {};
  const overflows: Record<string, unknown> = {};

  await tourEveryScreen(page, async (name) => {
    const found = await axeFindings(page);
    if (found.length > 0) violations[name] = found;
    const wide = await overflow(page);
    if (wide !== null) overflows[name] = wide;
  });

  expect(violations, 'serious or critical axe violations').toEqual({});
  expect(overflows, 'pages wider than the viewport').toEqual({});
});

// The tablet width (UX-UI §7: 768), which neither project uses on its own.
test('at 768 px too: no serious axe violation, nothing wider than the screen', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'one run is enough for the tablet width');
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  const violations: Record<string, Finding[]> = {};
  const overflows: Record<string, unknown> = {};

  await tourEveryScreen(page, async (name) => {
    const found = await axeFindings(page);
    if (found.length > 0) violations[name] = found;
    const wide = await overflow(page);
    if (wide !== null) overflows[name] = wide;
  });

  expect(violations).toEqual({});
  expect(overflows).toEqual({});
});
