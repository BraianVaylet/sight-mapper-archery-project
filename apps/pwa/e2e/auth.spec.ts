import { expect, test } from '@playwright/test';
import { signUpAndVerify } from './helpers.js';

test('sign up, verify the email, land on the home, then sign in again', async ({
  page,
  context,
}) => {
  // A private screen sends a stranger to sign-in.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  const archer = await signUpAndVerify(page);

  // A new session: sign in by username.
  await context.clearCookies();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByLabel('Email o usuario').fill(archer.username);
  await page.getByLabel('Contraseña', { exact: true }).fill(archer.password);
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
