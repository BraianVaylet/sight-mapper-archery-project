import { expect, test } from '@playwright/test';
import { buildSetupWithMarks, signUpAndVerify } from './helpers.js';

// HU-CAL-05 on the real stack: the sheet that comes out on paper is the sheet and nothing else,
// and it fits one page of A4 and of Letter.
test('print the list: only the sheet is paper, in black and white, on one page', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signUpAndVerify(page);
  await buildSetupWithMarks(page, [
    ['20', '0,3'],
    ['30', '0,8'],
    ['40', '1,6'],
    ['50', '2,6'],
    ['60', '3,6'],
  ]);

  await page.getByRole('link', { name: 'Imprimir' }).click();
  await expect(page.getByRole('heading', { name: 'Listado imprimible', level: 1 })).toBeVisible();
  const sheet = page.getByRole('article', { name: 'Marcas de mira' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('row')).toHaveCount(10); // header + 20, 25 … 60

  // On paper: the frame, the footer and the controls are gone; the sheet stays, ink on white.
  await page.emulateMedia({ media: 'print' });
  await expect(sheet).toBeVisible();
  await expect(page.locator('header')).toBeHidden();
  await expect(page.locator('footer')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeHidden();
  await expect(page.getByLabel('Desde')).toBeHidden();
  const colors = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return { background: body.backgroundColor, color: body.color };
  });
  expect(colors).toEqual({ background: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 0)' });

  // "Save as PDF": one sheet, on A4 and on Letter, with no cut table.
  const pages = (pdf: Buffer) =>
    (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  expect(pages(await page.pdf({ format: 'A4', printBackground: false }))).toBe(1);
  expect(pages(await page.pdf({ format: 'Letter', printBackground: false }))).toBe(1);

  // The counter is honest: a long list (every 1, 41 rows) needs more than one page.
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('radio', { name: '1', exact: true }).click();
  await expect(sheet.getByRole('row')).toHaveCount(42);
  await page.emulateMedia({ media: 'print' });
  expect(pages(await page.pdf({ format: 'A4' }))).toBeGreaterThan(1);
});
