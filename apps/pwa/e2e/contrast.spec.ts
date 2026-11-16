import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { contrastProblems } from './contrast.js';
import { tourEveryScreen } from './tour.js';

/** `SM_SCREENS=1` also saves the reference screenshots of every screen, at 360 px (docs/screens). */
const SCREENS = process.env['SM_SCREENS'] === '1';
const SCREENS_DIR = join(import.meta.dirname, '..', '..', '..', 'docs', 'screens');
const slug = (name: string) =>
  name
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

// F1-18: every screen, in the dark theme of the design and the light one for the sun, passes WCAG
// AA contrast with the colours the browser really paints (UX-UI §2.2).
for (const scheme of ['dark', 'light'] as const) {
  test(`every screen passes AA contrast in the ${scheme} theme`, async ({ page }, info) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ colorScheme: scheme });
    const found: Record<string, unknown[]> = {};
    let shot = 0;

    await tourEveryScreen(page, async (name) => {
      if (SCREENS && info.project.name === 'phone-360') {
        mkdirSync(join(SCREENS_DIR, scheme), { recursive: true });
        shot += 1;
        await page.screenshot({
          path: join(SCREENS_DIR, scheme, `${String(shot).padStart(2, '0')}-${slug(name)}.png`),
          fullPage: true,
          animations: 'disabled',
          scale: 'css',
        });
      }
      const problems = await contrastProblems(page);
      if (problems.length > 0) found[name] = problems;
    });

    expect(found, `contrast below AA in the ${scheme} theme`).toEqual({});
  });
}
