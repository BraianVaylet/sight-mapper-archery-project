import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MAIL_FILE } from '../playwright.config.js';

/** The link `dev:local` logged for an address: the email is never really sent. */
async function linkFor(address: string): Promise<string> {
  // 60 tries, a quarter of a second apart: no clock needed.
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const entries = readFileSync(MAIL_FILE, 'utf8')
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as { to: string; link?: string });
      const found = entries.filter((entry) => entry.to === address).at(-1);
      if (found?.link !== undefined) return found.link;
    } catch {
      // The file does not exist until the first email.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no email link for ${address}`);
}

test('sign up, verify the email, land on the home, then sign in again', async ({
  page,
  context,
}) => {
  const id = randomBytes(4).toString('hex');
  const email = `e2e-${id}@example.com`;
  const username = `e2e${id}`;
  const password = randomBytes(12).toString('hex');

  // A private screen sends a stranger to sign-in.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await page.getByRole('link', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Repetí la contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();

  // Opening the link verifies the account and signs the archer in.
  await page.goto(await linkFor(email));
  await expect(page.getByRole('heading', { name: 'Email verificado' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir al inicio' }).click();
  await expect(page.getByRole('heading', { name: 'Tus setups' })).toBeVisible();

  // A new session: sign in by username.
  await context.clearCookies();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByLabel('Email o usuario').fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Tus setups' })).toBeVisible();
});

test('a wrong password says so without saying which part was wrong', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email o usuario').fill('nobody');
  await page.getByLabel('Contraseña', { exact: true }).fill('wrong-password-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('Usuario o contraseña incorrectos.');
});
