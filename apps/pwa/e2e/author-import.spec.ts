import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_URL } from '../playwright.config.js';
import { signUpAndVerify } from './helpers.js';

// F1-21: the author's real marks go in through the API with their own session, and the app shows
// exactly the readings they had. Run against the throwaway stack, never against production here.

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'import-author-data.mjs');
const OUT = join(import.meta.dirname, '..', 'e2e-results');

type Run = { code: number; output: string };

function runImport(cookie: string, file: string, ...flags: string[]): Run {
  try {
    const output = execFileSync('node', [SCRIPT, '--file', file, '--api', DEV_URL, ...flags], {
      env: { ...process.env, SM_SESSION_COOKIE: cookie },
      encoding: 'utf8',
    });
    return { code: 0, output };
  } catch (error) {
    const failed = error as { status: number; stdout: string; stderr: string };
    return { code: failed.status, output: `${failed.stdout}${failed.stderr}` };
  }
}

/** The data file the author would write: the example, with the bow filled in. */
function dataFile(name: string, change?: (data: Record<string, unknown>) => void): string {
  const example = JSON.parse(
    readFileSync(join(ROOT, 'scripts', 'data', 'author-sets.example.json'), 'utf8'),
  ) as Record<string, unknown> & { bows: Record<string, string>[] };
  const bow = example.bows[0];
  if (bow !== undefined) {
    bow['manufacturer'] = 'PSE';
    bow['model'] = 'Evo NXT 35';
  }
  change?.(example);
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, name);
  writeFileSync(file, JSON.stringify(example));
  return file;
}

const sessionCookie = async (page: Page) =>
  (await page.context().cookies())
    .filter((c) => c.name.includes('session'))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

const readingsOf = async (page: Page) =>
  page
    .getByRole('table')
    .getByRole('row')
    .evaluateAll((rows) =>
      rows.slice(1).map((r) => {
        const cells = r.querySelectorAll('th, td');
        return `${cells[0]?.textContent?.trim()} ${cells[1]?.textContent?.trim()}`;
      }),
    );

test('import the real marks with the archer own session: dry run, apply, again, a conflict', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'it writes to one account: one run is enough');
  test.setTimeout(120_000);

  // Without a valid session it refuses, and says why.
  const stranger = runImport(
    'better-auth.session_token=not-a-session',
    dataFile('author-import-x.json'),
  );
  expect(stranger.code).toBe(1);
  expect(stranger.output).toContain('the session is not valid here');

  await signUpAndVerify(page);
  const cookie = await sessionCookie(page);
  expect(cookie).not.toBe('');
  const file = dataFile('author-import.json');

  // A dry run reads and says what it would do; nothing is written.
  const dry = runImport(cookie, file);
  expect(dry.code).toBe(0);
  expect(dry.output).toContain('Dry run: nothing was written');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toBeVisible();

  // Applied: the setup, its two arrow sets and the ten marks, with the readings the author had.
  const applied = runImport(cookie, file, '--apply');
  expect(applied.code, applied.output).toBe(0);
  expect(applied.output).toContain('Done.');
  await page.goto('/');
  await page.getByRole('link', { name: 'Abrir' }).click();
  await expect(page.getByRole('heading', { name: 'Ultraview', level: 1 })).toBeVisible();
  await expect
    .poll(() => readingsOf(page))
    .toEqual(['20 m 0,3', '30 m 0,8', '40 m 1,6', '50 m 2,6', '60 m 3,6']);
  await page.getByLabel('Set de flechas').selectOption({ label: 'Gold Tip Pierce 400' });
  await expect
    .poll(() => readingsOf(page))
    .toEqual(['20 m 0,4', '30 m 1,0', '40 m 1,8', '50 m 2,5', '60 m 3,5']);

  // Again: nothing new, nothing duplicated.
  const again = runImport(cookie, file, '--apply');
  expect(again.code, again.output).toBe(0);
  expect(again.output).not.toContain('created');
  await page.reload();
  await expect(page.getByText(/Marcas: 5 · 20–60 m/)).toBeVisible();

  // A different reading for a distance already there is a conflict: reported, never overwritten
  // unless asked.
  const changed = dataFile('author-import-changed.json', (data) => {
    const setups = data['setups'] as { marks: Record<string, [number, number][]> }[];
    const pierce = setups[0]?.marks['pierce'];
    if (pierce?.[2]) pierce[2] = [40, 1.7];
  });
  const conflict = runImport(cookie, changed, '--apply');
  expect(conflict.code).toBe(3);
  expect(conflict.output).toContain('40 m → 1.7 (pierce): the app has a different reading there');
  await page.reload();
  await expect.poll(() => readingsOf(page)).toContain('40 m 1,8');

  const replaced = runImport(cookie, changed, '--apply', '--replace');
  expect(replaced.code, replaced.output).toBe(0);
  await page.reload();
  await expect.poll(() => readingsOf(page)).toContain('40 m 1,7');
  await expect(page.getByText(/Marcas: 5 · 20–60 m/)).toBeVisible();
});
