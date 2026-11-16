import { expect, test } from '@playwright/test';
import { signUpAndVerify } from './helpers.js';

// F1-12: the critical flow for an archer in yards and inches, on the real stack. What is stored is
// canonical (metres, millimetres): a reload proves the round trip gives back what was typed.
test('build equipment and measure marks in yards and inches, and find them as typed after a reload', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signUpAndVerify(page);

  await page.goto('/settings/appearance');
  await page.getByRole('radio', { name: 'Imperial (yardas)' }).click();
  await expect(page.getByRole('radio', { name: 'Imperial (yardas)' })).toBeChecked();

  // A bow with a fraction of an inch: 6 1/4 in is stored as 158.75 mm and comes back as 6,25.
  await page.goto('/bows/new');
  await page.getByLabel('Fabricante').fill('Hoyt');
  await page.getByLabel('Modelo').fill('Alpha');
  await page.getByLabel('Brace height').fill('6 1/4');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Hoyt Alpha' })).toBeVisible();
  await page.goto('/bows');
  await page.getByRole('link', { name: 'Editar arco' }).click();
  await expect(page.getByLabel('Brace height')).toHaveValue('6,25');

  await page.goto('/sights/new');
  await page.getByLabel('Modelo').fill('Ultraview');
  await page.getByLabel('Mínimo').fill('0');
  await page.getByLabel('Máximo').fill('10');
  await page.getByLabel('Paso más chico').fill('0,1');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Ultraview' })).toBeVisible();

  await page.goto('/arrows/new');
  await page.getByLabel('Nombre corto').fill('Hunter 400');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Hunter 400' })).toBeVisible();

  await page.goto('/setups/new');
  await page.getByLabel('Arco').selectOption({ label: 'Hoyt Alpha' });
  await page.getByLabel('Mira').selectOption({ label: 'Ultraview' });
  await page.getByRole('checkbox', { name: 'Hunter 400' }).check();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Todavía no hay marcas')).toBeVisible();

  // Marks at whole yards.
  for (const [distance, reading] of [
    ['20', '0,3'],
    ['30', '0,8'],
    ['40', '1,6'],
  ] as const) {
    await page.getByRole('button', { name: '+ Agregar marca' }).click();
    await page.getByLabel('Distancia', { exact: true }).fill(distance);
    await page.getByLabel('Lectura', { exact: true }).fill(reading);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(
      page.getByRole('button', { name: `Elegir la marca de ${distance} yd` }),
    ).toBeVisible();
  }
  await expect(page.getByText('Marcas: 3 · 20–40 yd')).toBeVisible();

  // Back from the server: still 20, 30 and 40 yd, not 21,9 or 19,99.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Elegir la marca de 30 yd' })).toBeVisible();
  await expect(page.getByText('Marcas: 3 · 20–40 yd')).toBeVisible();

  // Intermediates on a grid of yards, and a free query in yards.
  await page.getByRole('link', { name: 'Intermedias' }).click();
  await expect(page.getByRole('row')).toHaveCount(6); // header + 20, 25, 30, 35, 40 yd
  await expect(page.getByRole('button', { name: 'Elegir 25 yd' })).toBeVisible();
  await page.getByLabel('Distancia', { exact: true }).fill('33');
  await page.getByRole('button', { name: 'Ver lectura' }).click();
  await expect(page.getByText(/^33 yd/).first()).toContainText('≈');

  // No metric distance anywhere on the screen.
  await expect(page.locator('body')).not.toContainText(/\d\s?m\b(?!\/)/);
});
