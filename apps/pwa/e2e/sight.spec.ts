import { expect, test } from '@playwright/test';
import { signUpAndVerify } from './helpers.js';

// The core of the product on the real stack: measure marks, see the estimate between them, fix one.
test('measure marks on the sight screen, read an estimate between them, replace and undo', async ({
  page,
}) => {
  await signUpAndVerify(page);

  await page.goto('/bows/new');
  await page.getByLabel('Fabricante').fill('Hoyt');
  await page.getByLabel('Modelo').fill('Alpha');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Hoyt Alpha' })).toBeVisible();

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

  // Saving the setup lands on its sight screen, still without marks.
  await page.goto('/setups/new');
  await page.getByLabel('Nombre (opcional)').fill('Caza');
  await page.getByLabel('Arco').selectOption({ label: 'Hoyt Alpha' });
  await page.getByLabel('Mira').selectOption({ label: 'Ultraview' });
  await page.getByRole('checkbox', { name: 'Hunter 400' }).check();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Todavía no hay marcas')).toBeVisible();

  // Three marks of the author's real set.
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
      page.getByRole('button', { name: `Elegir la marca de ${distance} m` }),
    ).toBeVisible();
  }
  await expect(page.getByText('Marcas: 3 · 20–40 m')).toBeVisible();

  // Between two marks the screen shows an estimate, marked as such.
  await page.getByRole('button', { name: 'Elegir la marca de 30 m' }).click();
  await expect(page.getByText('Lectura a 30 m')).toBeVisible();
  await page.goto(page.url().replace(/d=\d+/, 'd=35'));
  await expect(page.getByText('Lectura a 35 m')).toBeVisible();
  await expect(page.locator('p', { hasText: /^≈ \d/ })).toBeVisible();

  // The same distance again asks before replacing; the answer sticks after a reload.
  await page.getByRole('button', { name: '+ Agregar marca' }).click();
  await page.getByLabel('Distancia', { exact: true }).fill('30');
  await page.getByLabel('Lectura', { exact: true }).fill('0,9');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('¿Reemplazar la marca?')).toBeVisible();
  await page.getByRole('button', { name: 'Reemplazar' }).click();
  await expect(page.getByText('Marca guardada')).toBeVisible();
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: '30 m' });
  await expect(row).toContainText('0,9');

  // Delete one and bring it back with Undo.
  await page.getByRole('button', { name: 'Editar la marca de 30 m' }).click();
  await page.getByRole('button', { name: 'Borrar la marca' }).click();
  await expect(page.getByText('Marca borrada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Elegir la marca de 30 m' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Elegir la marca de 30 m' })).toBeVisible();

  // Intermediates: 20 to 40 m every 5 m, the measured ones as loaded, the rest estimated.
  await page.getByRole('link', { name: 'Intermedias' }).click();
  await expect(page.getByRole('heading', { name: 'Distancias', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Curva:/ })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(6); // header + 20, 25, 30, 35, 40
  await expect(page.getByRole('row').filter({ hasText: '25 m' })).toContainText('≈');
  await expect(page.getByRole('row').filter({ hasText: '30 m' })).not.toContainText('≈');

  // A free query: an estimate, kept in the URL, and no mark changed.
  await page.getByLabel('Distancia', { exact: true }).fill('33');
  await page.getByRole('button', { name: 'Ver lectura' }).click();
  await expect(page.getByText(/^33 m/).first()).toContainText('≈');
  await page.reload();
  await expect(page.getByText(/^33 m/).first()).toContainText('≈');
  await expect(page.getByRole('row')).toHaveCount(6);

  // Back on the sight screen the marks are as they were.
  await page.getByRole('link', { name: /La mira/ }).click();
  await expect(page.getByText('Marcas: 3 · 20–40 m')).toBeVisible();
});
