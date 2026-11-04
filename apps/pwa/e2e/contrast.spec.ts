import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { contrastProblems } from './contrast.js';
import { buildSetupWithMarks, signUpAndVerify } from './helpers.js';

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
    const audit = async (name: string, current: Page = page) => {
      // Let transitions and late paints settle before reading colours.
      await current.waitForTimeout(150);
      if (SCREENS && info.project.name === 'phone-360') {
        mkdirSync(join(SCREENS_DIR, scheme), { recursive: true });
        shot += 1;
        await current.screenshot({
          path: join(SCREENS_DIR, scheme, `${String(shot).padStart(2, '0')}-${slug(name)}.png`),
          fullPage: true,
          animations: 'disabled',
          scale: 'css',
        });
      }
      const problems = await contrastProblems(current);
      if (problems.length > 0) found[name] = problems;
    };

    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await audit('sign in');
    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
    await audit('sign up');

    await signUpAndVerify(page);
    await expect(page.getByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toBeVisible();
    await audit('home: the guide');

    await buildSetupWithMarks(page, [
      ['20', '0,3'],
      ['30', '0,8'],
      ['40', '2,4'],
      ['50', '2,6'],
      ['60', '3,6'],
    ]);
    const setupPath = new URL(page.url()).pathname;
    await expect(page.getByRole('table')).toBeVisible();
    await audit('sight screen');

    await page.getByRole('button', { name: '+ Agregar marca' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Completá este campo.').first()).toBeVisible();
    await audit('mark sheet with errors');
    await page.keyboard.press('Escape');

    for (const [name, path, ready] of [
      ['home', '/', 'Tus setups'],
      ['bows', '/bows', 'Arcos'],
      ['new bow', '/bows/new', 'Nuevo arco'],
      ['sights', '/sights', 'Miras'],
      ['new sight', '/sights/new', 'Nueva mira'],
      ['arrows', '/arrows', 'Flechas'],
      ['new setup', '/setups/new', 'Nuevo setup'],
      ['distances', `${setupPath}/distances`, 'Distancias'],
      ['doctor', `${setupPath}/doctor`, 'Mark Doctor'],
      ['print', `${setupPath}/print`, 'Listado imprimible'],
      ['trash', '/trash', 'Papelera'],
      ['profile', '/profile', 'Cuenta'],
      ['appearance', '/settings/appearance', 'Apariencia'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: ready, level: 1 })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await audit(name);
    }

    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir el menú' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await audit('menu');

    expect(found, `contrast below AA in the ${scheme} theme`).toEqual({});
  });
}
