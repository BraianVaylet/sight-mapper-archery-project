import { expect, test } from '@playwright/test';
import { signUpAndVerify } from './helpers.js';

// F1-17: a new archer reaches the first mark without ever leaving the guide (FUNCIONAL §2.1).
test('a new archer follows the guide from an empty Home to the first sight mark', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signUpAndVerify(page);

  // The empty Home is the guide: four steps, the first one to do.
  await expect(page.getByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toBeVisible();
  const step = (key: string) => page.locator(`[data-step="${key}"]`);
  await expect(step('bow')).toHaveAttribute('data-state', 'current');
  await expect(step('setup').getByRole('link')).toHaveCount(0);

  // 1. The bow: its form comes back to the guide on saving.
  await step('bow').getByRole('link', { name: 'Cargar arco' }).click();
  await page.getByLabel('Fabricante').fill('Hoyt');
  await page.getByLabel('Modelo').fill('Alpha');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toBeVisible();
  await expect(step('bow')).toHaveAttribute('data-state', 'done');
  await expect(step('bow')).toContainText('Hoyt Alpha');
  await expect(step('sight')).toHaveAttribute('data-state', 'current');

  // 2. The sight, with its scale.
  await step('sight').getByRole('link', { name: 'Cargar mira' }).click();
  await page.getByLabel('Modelo').fill('Ultraview');
  await page.getByLabel('Mínimo').fill('0');
  await page.getByLabel('Máximo').fill('10');
  await page.getByLabel('Paso más chico').fill('0,1');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(step('sight')).toHaveAttribute('data-state', 'done');

  // 3. The arrows: only the name.
  await step('arrows').getByRole('link', { name: 'Cargar flechas' }).click();
  await page.getByLabel('Nombre corto').fill('Hunter 400');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(step('arrows')).toHaveAttribute('data-state', 'done');

  // 4. The setup: what was loaded is already chosen, so saving is all there is.
  await expect(step('setup')).toHaveAttribute('data-state', 'current');
  await step('setup').getByRole('link', { name: 'Crear setup' }).click();
  await expect(page.getByLabel('Arco').locator('option:checked')).toHaveText('Hoyt Alpha');
  await expect(page.getByLabel('Mira').locator('option:checked')).toHaveText('Ultraview');
  await expect(page.getByRole('checkbox', { name: 'Hunter 400' })).toBeChecked();
  await page.getByRole('button', { name: 'Guardar' }).click();

  // The sight screen, empty, says what to do; the first mark goes in.
  await expect(page.getByText('Todavía no hay marcas')).toBeVisible();
  await page.getByRole('button', { name: '+ Agregar marca' }).click();
  await page.getByLabel('Distancia', { exact: true }).fill('30');
  await page.getByLabel('Lectura', { exact: true }).fill('0,8');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('button', { name: 'Elegir la marca de 30 m' })).toBeVisible();

  // The guide has done its job: the Home shows the setup now.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toHaveCount(0);
  await expect(page.getByText('Marcas: 1')).toBeVisible();
});

test('an archer who loads the sight first still gets there: the guide does not force an order', async ({
  page,
}) => {
  await signUpAndVerify(page);
  await page.goto('/sights/new?next=home');
  await page.getByLabel('Modelo').fill('Ultraview');
  await page.getByLabel('Mínimo').fill('0');
  await page.getByLabel('Máximo').fill('10');
  await page.getByLabel('Paso más chico').fill('0,1');
  await page.getByRole('button', { name: 'Guardar' }).click();
  // Back on the guide, the sight is crossed off and the bow is still the one to do.
  await expect(page.locator('[data-step="sight"]')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('[data-step="bow"]')).toHaveAttribute('data-state', 'current');
});
