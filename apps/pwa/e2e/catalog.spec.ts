import { expect, test } from '@playwright/test';
import { axeFindings, overflow } from './audits.js';
import { contrastProblems } from './contrast.js';

// F0-11: the visual catalogue (`/sandbox`, development only) shows every primitive of
// `@sight-mapper/ui`, and in both themes it passes axe, AA contrast and fits the screen.
for (const scheme of ['dark', 'light'] as const) {
  test(`the component catalogue passes axe and AA contrast in the ${scheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/sandbox');
    await expect(page.getByRole('heading', { name: 'Catálogo de componentes' })).toBeVisible();

    expect(await axeFindings(page), 'serious or critical axe violations').toEqual([]);
    expect(await contrastProblems(page), `contrast below AA in the ${scheme} theme`).toEqual([]);
    expect(await overflow(page), 'page wider than the viewport').toBeNull();
  });
}
