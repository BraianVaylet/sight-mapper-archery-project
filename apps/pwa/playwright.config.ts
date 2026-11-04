import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

/** Where `dev:local` drops the links of the emails it does not send. */
export const MAIL_FILE = join(import.meta.dirname, 'e2e-results', 'mail.jsonl');

export const DEV_URL = 'http://localhost:5173';
export const BUILD_URL = 'http://localhost:4173';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e-results/artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // In CI a forgotten `test.only` fails the run instead of silently skipping the rest.
  forbidOnly: process.env['CI'] === 'true',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  // The product opens in the browser's language: the specs read the Spanish screens.
  use: { baseURL: DEV_URL, locale: 'es-AR', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-360', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    // The whole product on a throwaway database: the same `pnpm dev:local` an archer runs.
    {
      command: 'node ../../scripts/dev-local.mjs',
      url: DEV_URL,
      reuseExistingServer: process.env['CI'] !== 'true',
      timeout: 240_000,
      env: { SM_DEV_MAIL_FILE: MAIL_FILE },
    },
    // The production build, for what only a build has: the manifest and the service worker.
    {
      command: 'pnpm build && pnpm exec vite preview --port 4173 --strictPort',
      url: BUILD_URL,
      reuseExistingServer: process.env['CI'] !== 'true',
      timeout: 240_000,
    },
  ],
});
