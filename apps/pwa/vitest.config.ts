import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('dev') },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/routeTree.gen.ts',
        // Wiring only (path, guard, which screen): the guards are covered by test/routing.test.tsx.
        'src/routes/**',
        'src/app/pwa-update.tsx',
        'src/env.d.ts',
      ],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
  },
});
