import { expect, test } from '@playwright/test';
import { buildSetupWithMarks, signUpAndVerify } from './helpers.js';

// HU-STP-03 on the real stack: "Always open here", the app opening on it, and the setup's deletion
// taking it away.
test('open the app straight on the sight, and fall back to the Home when the setup is deleted', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signUpAndVerify(page);
  await buildSetupWithMarks(page, [['30', '0,8']]);
  const setupPath = new URL(page.url()).pathname;

  const toggle = page.getByRole('button', { name: /siempre acá/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveText(/Se abre siempre acá/);

  // Opening the app: the Home is not where it lands.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Caza', level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(setupPath);
  expect(new URL(page.url()).searchParams.get('arrowSet')).not.toBeNull();

  // It survives a reload (it is the account's, not the tab's) and shows as set.
  await page.reload();
  await expect(page.getByRole('button', { name: /Se abre siempre acá/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Going back to the Home is not opening the app: it stays on the Home.
  await page.getByRole('link', { name: /Tus setups/ }).click();
  await expect(page.getByRole('heading', { name: 'Tus setups', level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');

  // Delete the setup: the quick access goes with it, and the app opens on the Home.
  await page.getByRole('link', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Mandar a la papelera' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(page.getByText('Todavía no tenés setups')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tus setups', level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');

  // Restoring it does not bring the quick access back.
  await page.getByRole('link', { name: 'Papelera' }).click();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('La papelera está vacía.')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tus setups', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Caza' })).toBeVisible();
});
