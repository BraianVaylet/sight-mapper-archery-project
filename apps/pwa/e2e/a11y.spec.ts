import { expect, test } from '@playwright/test';
import { axeFindings, overflow, type Finding } from './audits.js';
import { tourEveryScreen } from './tour.js';

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
