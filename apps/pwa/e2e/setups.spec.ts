import { expect, test } from '@playwright/test';
import { signUpAndVerify } from './helpers.js';

// The critical path of the product so far, on the real stack: equipment, a setup, the Home, the trash.
test('load a bow, a sight and arrows, build a setup, star it, trash it and bring it back', async ({
  page,
}) => {
  await signUpAndVerify(page);

  // A bow, with a value the form must convert and check.
  await page.goto('/bows/new');
  await page.getByLabel('Fabricante').fill('Hoyt');
  await page.getByLabel('Modelo').fill('Alpha');
  await page.getByLabel('Brace height').fill('158,75');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Hoyt Alpha' })).toBeVisible();

  // The author's sight: cm, 0 to 10, steps of 0.1. The ruler preview appears while typing.
  await page.goto('/sights/new');
  await page.getByLabel('Modelo').fill('Ultraview');
  await page.getByLabel('Mínimo').fill('0');
  await page.getByLabel('Máximo').fill('10');
  await page.getByLabel('Paso más chico').fill('0,1');
  await expect(page.getByRole('img', { name: /Vista previa de la escala/ })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Ultraview' })).toBeVisible();

  // Arrows: only the name is needed.
  await page.goto('/arrows/new');
  await page.getByLabel('Nombre corto').fill('Hunter 400');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Hunter 400' })).toBeVisible();

  // The setup joins them.
  await page.goto('/setups/new');
  await page.getByLabel('Nombre (opcional)').fill('Caza');
  await page.getByLabel('Arco').selectOption({ label: 'Hoyt Alpha' });
  await page.getByLabel('Mira').selectOption({ label: 'Ultraview' });
  await page.getByRole('checkbox', { name: 'Hunter 400' }).check();
  await page.getByRole('button', { name: 'Guardar' }).click();
  // Saving lands on the sight screen of the new setup.
  await expect(page.getByRole('heading', { name: 'Caza' })).toBeVisible();
  await expect(page.getByText('Todavía no hay marcas')).toBeVisible();

  // The Home shows it; the star is immediate.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Caza' })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como favorito' }).click();
  await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toBeVisible();

  // The same pair again is refused, naming the setup that has it.
  await page.goto('/setups/new');
  await page.getByLabel('Arco').selectOption({ label: 'Hoyt Alpha' });
  await page.getByLabel('Mira').selectOption({ label: 'Ultraview' });
  await page.getByRole('checkbox', { name: 'Hunter 400' }).check();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Ya tenés un setup con ese arco y esa mira.')).toBeVisible();

  // A bow that a setup uses cannot be deleted: it is archived instead.
  await page.goto('/bows');
  await page.getByRole('link', { name: 'Editar arco' }).click();
  await page.getByRole('button', { name: 'Borrar este arco' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(page.getByText(/Está en uso en 1 setups/).first()).toBeVisible();

  // To the trash and back.
  await page.goto('/');
  await page.getByRole('link', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Mandar a la papelera' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(page.getByText('Todavía no tenés setups')).toBeVisible();

  await page.getByRole('link', { name: 'Papelera' }).click();
  await expect(page.getByRole('heading', { name: 'Caza' })).toBeVisible();
  await expect(page.getByText(/Se elimina el/)).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('La papelera está vacía.')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Caza' })).toBeVisible();
});
