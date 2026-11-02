import { describe, expect, it } from 'vitest';
import { createContainer } from '../src/composition-root.js';
import { createLogger } from '../src/core/logger/logger.js';
import { testEnv } from './helpers/app.js';
import {
  checkIsolation,
  expectForeign404,
  routeKey,
  uncovered,
  type Attack,
} from './helpers/isolation.js';
import { buildThingsApi, thingsAttacks } from './helpers/things-api.js';

const attacks = thingsAttacks(expectForeign404);
const FIVE = [
  'POST /api/v1/things',
  'GET /api/v1/things',
  'GET /api/v1/things/{id}',
  'PATCH /api/v1/things/{id}',
  'DELETE /api/v1/things/{id}',
];

describe('the production routes (test #1, spec §13)', () => {
  /**
   * Every module that registers a session route adds its attacks here, in the same change. The
   * account routes need a database to exist, so their attacks run against the real container in
   * `account.test.ts` (`checkIsolation` fails any session route without one).
   */
  const productionAttacks: Attack[] = [];

  it('every registered session route has an isolation attack', () => {
    const { registry } = createContainer({
      env: testEnv,
      logger: createLogger({ level: 'silent' }),
    });
    expect(uncovered(registry.routes, productionAttacks)).toEqual([]);
  });

  it('knows which routes need a session: health and readiness do not', () => {
    const { registry } = createContainer({
      env: testEnv,
      logger: createLogger({ level: 'silent' }),
    });
    expect(registry.routes.map((r) => `${routeKey(r)}:${r.auth}`).sort()).toEqual([
      'GET /health:public',
      'GET /ready:public',
    ]);
  });
});

describe('the suite itself', () => {
  it('passes for an API that keeps archers apart, across all five kinds of route', async () => {
    const api = buildThingsApi('scoped');
    expect(
      api.registry.routes
        .filter((r) => r.auth === 'session')
        .map(routeKey)
        .sort(),
    ).toEqual([...FIVE].sort());
    expect(await checkIsolation(api.app, api.registry.routes, attacks)).toEqual([]);
  });

  it('fails every route of an API with one table for everybody (the classic leak)', async () => {
    const api = buildThingsApi('leaky');
    const violations = await checkIsolation(api.app, api.registry.routes, attacks);
    expect(violations.map((v) => v.route).sort()).toEqual([...FIVE].sort());
    for (const v of violations) expect(v.problem.length).toBeGreaterThan(10);
  });

  it('fails a route registered without an attack fixture', async () => {
    const api = buildThingsApi('scoped');
    const withoutPatch = attacks.filter((a) => a.route !== 'PATCH /api/v1/things/{id}');
    expect(uncovered(api.registry.routes, withoutPatch)).toEqual(['PATCH /api/v1/things/{id}']);
    const violations = await checkIsolation(api.app, api.registry.routes, withoutPatch);
    expect(violations).toEqual([
      { route: 'PATCH /api/v1/things/{id}', problem: 'no isolation attack for this session route' },
    ]);
  });

  it('fails when no attack is given at all', async () => {
    const api = buildThingsApi('scoped');
    const violations = await checkIsolation(api.app, api.registry.routes, []);
    expect(violations).toHaveLength(FIVE.length);
  });

  it('does not ask for an attack on public routes', () => {
    const { registry } = createContainer({
      env: testEnv,
      logger: createLogger({ level: 'silent' }),
    });
    expect(uncovered(registry.routes, [])).toEqual([]);
  });

  it('flags an attack aimed at a route that does not exist', async () => {
    const api = buildThingsApi('scoped');
    const stale: Attack = { route: 'GET /api/v1/ghosts', run: () => Promise.resolve(null) };
    const violations = await checkIsolation(api.app, api.registry.routes, [...attacks, stale]);
    expect(violations).toEqual([
      { route: 'GET /api/v1/ghosts', problem: 'attack for a route that is not registered' },
    ]);
  });

  it('reports an attack that blows up instead of passing silently', async () => {
    const api = buildThingsApi('scoped');
    const broken: Attack = {
      route: 'GET /api/v1/things',
      run: () => Promise.reject(new Error('fixture bug')),
    };
    const rest = attacks.filter((a) => a.route !== broken.route);
    const violations = await checkIsolation(api.app, api.registry.routes, [...rest, broken]);
    expect(violations).toEqual([
      { route: 'GET /api/v1/things', problem: 'the attack itself failed: fixture bug' },
    ]);
  });
});

describe('expectForeign404', () => {
  const answer = (status: number, code: string) =>
    new Response(JSON.stringify({ success: false, error: { code } }), { status });

  it('accepts only 404 SM-CORE-404-002: not 403, not 200, not another 404', async () => {
    expect(await expectForeign404(answer(404, 'SM-CORE-404-002'))).toBeNull();
    expect(await expectForeign404(answer(403, 'SM-CORE-404-002'))).toMatch(/got 403/);
    expect(await expectForeign404(answer(200, 'SM-CORE-404-002'))).toMatch(/got 200/);
    expect(await expectForeign404(answer(404, 'SM-CORE-404-001'))).toMatch(/SM-CORE-404-001/);
  });
});
