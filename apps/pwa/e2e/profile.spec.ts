import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildSetupWithMarks, signUpAndVerify } from './helpers.js';

// HU-ACC-05 and HU-ACC-06 on the real stack: a real file comes down, and the deletion is asked for
// and cancelled. (The purge itself, 90 days later, is proved against the database in the API tests.)
test('download my data as a real file, ask for the deletion and cancel it', async ({ page }) => {
  test.setTimeout(90_000);
  const archer = await signUpAndVerify(page);
  await buildSetupWithMarks(page, [['30', '0,8']]);

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Cuenta', level: 1 })).toBeVisible();
  await expect(page.getByText(archer.username)).toBeVisible();
  await expect(page.getByText(archer.email)).toBeVisible();

  // The file: named by its date, JSON, with everything the archer loaded, in canonical units.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar mis datos' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^sight-mapper-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  const data = JSON.parse(readFileSync(path, 'utf8')) as {
    schemaVersion: number;
    bows: { model: string }[];
    sights: unknown[];
    arrowSets: unknown[];
    setups: { name?: string }[];
    marks: { distanceM: number; scaleValueMm: number }[];
  };
  expect(data.schemaVersion).toBe(1);
  expect(data.bows.map((b) => b.model)).toEqual(['Alpha']);
  expect(data.setups.map((s) => s.name)).toEqual(['Caza']);
  expect(data.marks).toMatchObject([{ distanceM: 30, scaleValueMm: 8 }]);
  expect(JSON.stringify(data)).not.toContain('"userId"');
  await expect(page.getByText(/^Listo: se descargó sight-mapper-/)).toBeVisible();

  // Ask for the deletion: only the exact username opens the button.
  await page.getByRole('button', { name: 'Pedir la baja' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Sí, pedir la baja' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(`Escribí ${archer.username} para confirmar`).fill(archer.username);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText('Pediste la baja')).toBeVisible();
  await expect(page.getByText(/Tu cuenta y todos tus datos se eliminan el /)).toBeVisible();
  // Nothing was removed: the app keeps working, and the request survives a reload.
  await page.reload();
  await expect(page.getByText('Pediste la baja')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Caza' })).toBeVisible();

  // Changed my mind.
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Cancelar la baja' }).click();
  await expect(page.getByText('Listo: la baja quedó cancelada.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pedir la baja' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pediste la baja')).toHaveCount(0);
});
