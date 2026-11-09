import { expect, test, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { linkFor } from './helpers.js';

// F1-13: the critical flow for an archer whose browser asks for English, on the real stack: the
// profile is born in English (and in yards), and no screen, error or email link says Spanish.
test.use({ locale: 'en-US' });

/** Words and signs only Spanish uses. The language name "Español" of the switcher is right. */
const SPANISH =
  /[¿¡áéíóúñ]|\b(Guardar|Cancelar|Borrar|Editar|Todavía|Nuevo|Nueva|Tus|Elegí|Volvé|Lectura|Distancia|Marcas?|Arcos?|Mira|Flechas|Papelera|Restaurar|Iniciar|Contraseña|Cuenta|Idioma|Tema|Versión|Herramientas|Próximamente|Reemplazar|Deshacer|Cerrar|Volver|Cargando|Usuario|Correo|Entrar|Salir)\b/;

async function inEnglish(page: Page, where: string) {
  const text = (await page.locator('body').innerText()).replace(/Español/g, '');
  expect(text.match(SPANISH)?.[0], `Spanish on "${where}"`).toBeUndefined();
  expect(text, where).not.toMatch(/\{\{/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

test('sign up, build equipment and a setup, measure marks, use the tools and sign out: all in English', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = randomBytes(4).toString('hex');
  const archer = {
    email: `e2e-${id}@example.com`,
    username: `e2e${id}`,
    password: randomBytes(12).toString('hex'),
  };

  await page.goto('/sign-up');
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await inEnglish(page, 'sign up');
  await page.getByLabel('Email', { exact: true }).fill(archer.email);
  await page.getByLabel('Username').fill(archer.username);
  await page.getByLabel('Password', { exact: true }).fill(archer.password);
  await page.getByLabel('Repeat the password').fill(archer.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await inEnglish(page, 'check your email');

  await page.goto(await linkFor(archer.email));
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
  await page.getByRole('link', { name: 'Go home' }).click();
  await expect(page.getByRole('heading', { name: 'Your setups' })).toBeVisible();
  await expect(page.getByText('You have no setups yet')).toBeVisible();
  await inEnglish(page, 'home');

  await page.goto('/bows/new');
  await inEnglish(page, 'new bow');
  await page.getByLabel('Manufacturer').fill('Hoyt');
  await page.getByLabel('Model').fill('Alpha');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Hoyt Alpha' })).toBeVisible();

  await page.goto('/sights/new');
  await inEnglish(page, 'new sight');
  await page.getByLabel('Model').fill('Ultraview');
  await page.getByLabel('Minimum').fill('0');
  await page.getByLabel('Maximum').fill('10');
  await page.getByLabel('Smallest step').fill('0.1');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Ultraview' })).toBeVisible();

  await page.goto('/arrows/new');
  await inEnglish(page, 'new arrow set');
  await page.getByLabel('Short name').fill('Hunter 400');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Hunter 400' })).toBeVisible();

  await page.goto('/setups/new');
  await inEnglish(page, 'new setup');
  await page.getByLabel('Bow', { exact: true }).selectOption({ label: 'Hoyt Alpha' });
  await page.getByLabel('Sight', { exact: true }).selectOption({ label: 'Ultraview' });
  await page.getByRole('checkbox', { name: 'Hunter 400' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('No marks yet')).toBeVisible();
  await inEnglish(page, 'sight screen, empty');

  // Five marks, the 40 yd one written 0.8 off: the Doctor has something to say. Decimal point, yards.
  for (const [distance, reading] of [
    ['20', '0.3'],
    ['30', '0.8'],
    ['40', '2.4'],
    ['50', '2.6'],
    ['60', '3.6'],
  ] as const) {
    await page.getByRole('button', { name: '+ Add sight mark' }).click();
    await page.getByLabel('Distance', { exact: true }).fill(distance);
    await page.getByLabel('Reading', { exact: true }).fill(reading);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByRole('button', { name: `Pick the mark at ${distance} yd` }),
    ).toBeVisible();
  }
  await expect(page.getByText('Marks: 5 · 20–60 yd')).toBeVisible();
  await inEnglish(page, 'sight screen');

  // A duplicate distance is asked about, in English.
  await page.getByRole('button', { name: '+ Add sight mark' }).click();
  await page.getByLabel('Distance', { exact: true }).fill('30');
  await page.getByLabel('Reading', { exact: true }).fill('0.9');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Replace the mark?')).toBeVisible();
  await inEnglish(page, 'replace dialog');
  await page.getByRole('button', { name: 'Keep the current one' }).click();

  await page.getByRole('link', { name: 'Intermediates' }).click();
  await expect(page.getByRole('heading', { name: 'Distances', level: 1 })).toBeVisible();
  await page.getByLabel('Distance', { exact: true }).fill('33');
  await page.getByRole('button', { name: 'Get reading' }).click();
  await expect(page.getByText(/^33 yd/).first()).toContainText('≈');
  await inEnglish(page, 'distances');

  await page.getByRole('link', { name: /The sight/ }).click();
  await page.getByRole('link', { name: 'Doctor' }).click();
  await expect(page.getByRole('heading', { name: 'Mark Doctor', level: 1 })).toBeVisible();
  await expect(page.getByText(/^Re-shoot \d+ yd: it is [\d.]+ cm off the trend\.$/)).toBeVisible();
  await inEnglish(page, 'mark doctor');

  // Sign out and fail to sign in: the error is English too.
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email or username').fill(archer.username);
  await page.getByLabel('Password', { exact: true }).fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect username or password.')).toBeVisible();
  await inEnglish(page, 'sign in error');
});
