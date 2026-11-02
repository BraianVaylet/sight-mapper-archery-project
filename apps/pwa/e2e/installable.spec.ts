import { expect, test } from '@playwright/test';
import { BUILD_URL } from '../playwright.config.js';

// What Lighthouse used to call "installable PWA", asked of Chrome itself on the production build.
test.describe('the production build is an installable PWA', () => {
  test.use({ baseURL: BUILD_URL });

  test('Chrome finds nothing that blocks installing it', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'installability is a Chromium feature');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    // Registered and active: needed for installability and for working offline.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

    const client = await page.context().newCDPSession(page);
    await client.send('Page.enable');
    const { installabilityErrors } = (await client.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[];
    };
    expect(installabilityErrors).toEqual([]);
  });

  test('the manifest names the app, opens it standalone and has maskable icons', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).not.toBeNull();
    const manifest = (await (await request.get(`${BUILD_URL}${href ?? ''}`)).json()) as {
      name: string;
      display: string;
      start_url: string;
      icons: { sizes: string; purpose?: string }[];
    };
    expect(manifest.name).toBe('Sight Mapper');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  test('the API is never answered from the service worker cache', async ({ page }) => {
    await page.goto('/');
    const worker = await page.evaluate(async () => {
      const response = await fetch('/sw.js');
      return response.text();
    });
    // Workbox writes the pattern escaped: denylist:[/^\/api\//]
    expect(worker).toMatch(/denylist:\[\/\^\\\/api\\\//);
  });
});
