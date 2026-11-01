import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = env['VITE_API_URL'] ?? 'http://localhost:3000';

  return {
    plugins: [
      // Must come before the React plugin: it writes `routeTree.gen.ts` from `src/routes`.
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      VitePWA({
        // The new version is offered, never forced: an archer may be mid-entry on the range.
        registerType: 'prompt',
        includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Sight Mapper',
          short_name: 'Sight Mapper',
          description: 'Sight marks for archers',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#10286b',
          theme_color: '#10286b',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
          navigateFallback: '/index.html',
          // The API and the identity endpoints are never answered from the cache.
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(env['VITE_APP_VERSION'] || 'dev'),
    },
    server: {
      port: 5173,
      // Same origin in development: the session cookie needs no CORS dance.
      proxy: { '/api': { target: apiUrl, changeOrigin: false } },
    },
    build: { sourcemap: true },
  };
});
