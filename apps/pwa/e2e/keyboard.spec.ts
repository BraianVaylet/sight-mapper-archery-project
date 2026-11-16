import { expect, test, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { linkFor } from './helpers.js';

// F1-19: the critical flow with the keyboard alone (UX-UI §6) — from creating the account to the
// first mark — never a click. Every stop of the focus must be visible.

/** What the focused element is called: its label, aria-label, or text. */
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null) return '';
    const labelled = el.getAttribute('aria-label');
    if (labelled) return labelled;
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      return by
        .split(/\s+/)
        .map((ref) => document.getElementById(ref)?.textContent?.trim() ?? '')
        .join(' ')
        .trim();
    }
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length > 0) return (labels[0]?.textContent ?? '').trim();
    return (el.textContent ?? '').trim();
  });

/** Is there a visible focus indicator on the focused element (an outline or a ring)? */
const focusVisible = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (el === null || el === document.body) return false;
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== 'none';
    return outline || ring;
  });

/** Tabs forward until the focus lands on something called `name`; fails after 60 stops. */
async function tabTo(page: Page, name: string | RegExp) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const current = await focusedName(page);
    if (typeof name === 'string' ? current === name : name.test(current)) {
      expect(await focusVisible(page), `focus is visible on "${current}"`).toBe(true);
      return;
    }
  }
  throw new Error(`the keyboard never reached "${String(name)}"`);
}

/** A link followed from the keyboard: wait for the new screen before the focus moves on. */
const arrive = (page: Page, heading: string) =>
  expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();

const startFromTop = (page: Page) =>
  page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });

test('the whole flow with the keyboard alone: account, equipment, setup, first mark', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = randomBytes(4).toString('hex');
  const email = `kb-${id}@example.com`;
  const password = randomBytes(12).toString('hex');

  // Create the account.
  await page.goto('/sign-up');
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
  await tabTo(page, 'Email');
  await page.keyboard.type(email);
  await tabTo(page, 'Usuario');
  await page.keyboard.type(`kb${id}`);
  await tabTo(page, 'Contraseña');
  await page.keyboard.type(password);
  await tabTo(page, 'Repetí la contraseña');
  await page.keyboard.type(password);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();
  await page.goto(await linkFor(email));
  await expect(page.getByRole('heading', { name: 'Email verificado' })).toBeVisible();
  await tabTo(page, 'Ir al inicio');
  await page.keyboard.press('Enter');
  await arrive(page, 'Tus setups');

  // The guide: each step from the keyboard, and each form submitted with Enter.
  await expect(page.getByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toBeVisible();
  await tabTo(page, 'Cargar arco');
  await page.keyboard.press('Enter');
  await arrive(page, 'Nuevo arco');
  await tabTo(page, 'Modelo');
  await page.keyboard.type('Alpha');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-step="bow"]')).toHaveAttribute('data-state', 'done');

  await startFromTop(page);
  await tabTo(page, 'Cargar mira');
  await page.keyboard.press('Enter');
  await arrive(page, 'Nueva mira');
  await tabTo(page, 'Modelo');
  await page.keyboard.type('Ultraview');
  await tabTo(page, 'Mínimo');
  await page.keyboard.type('0');
  await tabTo(page, 'Máximo');
  await page.keyboard.type('10');
  await tabTo(page, 'Paso más chico');
  await page.keyboard.type('0,1');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-step="sight"]')).toHaveAttribute('data-state', 'done');

  await startFromTop(page);
  await tabTo(page, 'Cargar flechas');
  await page.keyboard.press('Enter');
  await arrive(page, 'Nuevo set');
  await tabTo(page, 'Nombre corto');
  await page.keyboard.type('Hunter 400');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-step="arrows"]')).toHaveAttribute('data-state', 'done');

  await startFromTop(page);
  await tabTo(page, 'Crear setup');
  await page.keyboard.press('Enter');
  await arrive(page, 'Nuevo setup');
  await expect(page.getByRole('checkbox', { name: 'Hunter 400' })).toBeChecked();
  await tabTo(page, 'Guardar');
  await page.keyboard.press('Enter');

  // The first mark: the sheet opens on the distance, Tab goes past the steppers to the reading.
  await expect(page.getByText('Todavía no hay marcas')).toBeVisible();
  await tabTo(page, '+ Agregar marca');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await focusedName(page)).toBe('Distancia');
  await page.keyboard.type('30');
  await tabTo(page, 'Lectura');
  await page.keyboard.type('0,8');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Elegir la marca de 30 m' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A second mark with the stepper, from the keyboard, then the table walked with the arrows.
  await startFromTop(page);
  await tabTo(page, '+ Agregar marca');
  await page.keyboard.press('Enter');
  await page.keyboard.type('40');
  await tabTo(page, 'Lectura más');
  for (let i = 0; i < 16; i++) await page.keyboard.press('Enter');
  await tabTo(page, 'Guardar');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Elegir la marca de 40 m' })).toBeVisible();

  await startFromTop(page);
  await tabTo(page, 'Elegir la marca de 30 m');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Lectura a 30 m')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText('Lectura a 40 m')).toBeVisible();

  // The sheet closes with Escape and gives the focus back.
  await tabTo(page, '+ Agregar marca');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await focusedName(page)).toBe('+ Agregar marca');
});
