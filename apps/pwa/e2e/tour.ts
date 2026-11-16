import { expect, type Page } from '@playwright/test';
import { buildSetupWithMarks, signUpAndVerify } from './helpers.js';

/**
 * Every screen of the product, in a state worth looking at: the public ones, the guide, the sight
 * screen with five marks (one suspect), the mark sheet with its errors, equipment, the tools, the
 * account and the menu. `visit` is called on each once it has settled. Shared by the audits of
 * contrast (F1-18), accessibility and layout (F1-19), so they all look at the same screens.
 */
export async function tourEveryScreen(
  page: Page,
  visit: (name: string) => Promise<void>,
): Promise<void> {
  const settled = async (name: string) => {
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    // Let transitions and late paints settle.
    await page.waitForTimeout(150);
    await visit(name);
  };

  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await settled('sign in');
  await page.goto('/sign-up');
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
  await settled('sign up');

  await signUpAndVerify(page);
  await expect(page.getByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toBeVisible();
  await settled('home: the guide');

  await buildSetupWithMarks(page, [
    ['20', '0,3'],
    ['30', '0,8'],
    ['40', '2,4'],
    ['50', '2,6'],
    ['60', '3,6'],
  ]);
  const setupPath = new URL(page.url()).pathname;
  await expect(page.getByRole('table')).toBeVisible();
  await settled('sight screen');

  await page.getByRole('button', { name: '+ Agregar marca' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Completá este campo.').first()).toBeVisible();
  await settled('mark sheet with errors');
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
    await settled(name);
  }

  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir el menú' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await settled('menu');
}
