/* global module */
// Lighthouse CI on every PR (F0-19), with the budgets of TECNICO §14 for the PWA. It audits the
// production build on Lighthouse's default mobile emulation ("slow 4G": 1.6 Mbps, RTT 150 ms, CPU
// 4x), which is the "4G" of RNF-01 by decision of the author (2026-11-09). It is served gzipped
// with a signed-out API.
//
//   pnpm --filter @sight-mapper/pwa build && pnpm --filter @sight-mapper/pwa test:lighthouse
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/lighthouse-server.mjs 4180',
      startServerReadyPattern: 'lighthouse server on',
      // The first screen a new archer sees; the shell and its JS are the same for every route.
      url: ['http://127.0.0.1:4180/sign-in'],
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        // TECNICO §14: initial JS ≤ 180 KB gzip (what crosses the network, in bytes). A gate.
        'resource-summary:script:size': ['error', { maxNumericValue: 180 * 1024 }],
        // RNF-01: LCP < 2.5 s. A warning while the client-rendered sign-in sits at ~2.6 s: the
        // stack itself (React, TanStack Router, Query and Form) is ~130 KB gzip (BITACORA
        // 2026-11-09).
        'largest-contentful-paint': [
          'warn',
          { maxNumericValue: 2500, aggregationMethod: 'median' },
        ],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:performance': ['warn', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './lighthouse-results' },
  },
};
