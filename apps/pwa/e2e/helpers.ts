import { expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MAIL_FILE } from '../playwright.config.js';

/** The link `dev:local` logged for an address: the email is never really sent. */
export async function linkFor(address: string): Promise<string> {
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

export type Archer = { email: string; username: string; password: string };

/** A fresh account, made the way an archer makes one, and left signed in on the home screen. */
export async function signUpAndVerify(page: Page): Promise<Archer> {
  const id = randomBytes(4).toString('hex');
  const archer = {
    email: `e2e-${id}@example.com`,
    username: `e2e${id}`,
    password: randomBytes(12).toString('hex'),
  };

  await page.goto('/sign-up');
  await page.getByLabel('Email', { exact: true }).fill(archer.email);
  await page.getByLabel('Usuario').fill(archer.username);
  await page.getByLabel('Contraseña', { exact: true }).fill(archer.password);
  await page.getByLabel('Repetí la contraseña').fill(archer.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();

  await page.goto(await linkFor(archer.email));
  await expect(page.getByRole('heading', { name: 'Email verificado' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir al inicio' }).click();
  await expect(page.getByRole('heading', { name: 'Tus setups' })).toBeVisible();
  return archer;
}
