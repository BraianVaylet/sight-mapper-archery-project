import type { ErrorEnvelope } from '@sight-mapper/types';
import type { RegisteredRoute } from '../../src/core/registry/registry.js';

/**
 * The isolation suite (spec §13, test #1). It walks the route registry: every route that needs
 * a session must have an *attack*, a scenario where archer B tries to reach what archer A made.
 * A session route with no attack fails the suite, so a new endpoint cannot ship untested.
 */

export type AppLike = { request(path: string, init?: RequestInit): Response | Promise<Response> };

export type Violation = { readonly route: string; readonly problem: string };

export type AttackContext = {
  readonly userA: string;
  readonly userB: string;
  /** A request made as `user` (the test session reads the `x-test-user` header). */
  call(
    user: string,
    method: string,
    path: string,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<Response>;
};

/** Returns what went wrong, or `null` when the route kept the archers apart. */
export type Attack = {
  /** `METHOD /openapi/path`, exactly as the registry lists it. */
  readonly route: string;
  run(context: AttackContext): Promise<string | null>;
};

export const routeKey = (route: Pick<RegisteredRoute, 'method' | 'path'>): string =>
  `${route.method} ${route.path}`;

/** Session routes that no attack covers. */
export function uncovered(
  routes: readonly RegisteredRoute[],
  attacks: readonly Attack[],
): string[] {
  const covered = new Set(attacks.map((a) => a.route));
  return routes
    .filter((route) => route.auth === 'session')
    .map(routeKey)
    .filter((key) => !covered.has(key));
}

export async function checkIsolation(
  app: AppLike,
  routes: readonly RegisteredRoute[],
  attacks: readonly Attack[],
): Promise<Violation[]> {
  const violations: Violation[] = uncovered(routes, attacks).map((route) => ({
    route,
    problem: 'no isolation attack for this session route',
  }));

  const registered = new Set(routes.map(routeKey));
  for (const attack of attacks) {
    if (!registered.has(attack.route)) {
      violations.push({
        route: attack.route,
        problem: 'attack for a route that is not registered',
      });
    }
  }

  const context: AttackContext = {
    userA: 'archer-a',
    userB: 'archer-b',
    call: (user, method, path, options = {}) =>
      Promise.resolve(
        app.request(path, {
          method,
          headers: {
            'x-test-user': user,
            ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
            ...options.headers,
          },
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        }),
      ),
  };

  for (const attack of attacks.filter((a) => registered.has(a.route))) {
    let problem: string | null;
    try {
      problem = await attack.run(context);
    } catch (error) {
      problem = `the attack itself failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (problem !== null) violations.push({ route: attack.route, problem });
  }
  return violations;
}

/** The answer a foreign or missing resource must get: 404 `SM-CORE-404-002`, never 403 or the data. */
export async function expectForeign404(response: Response): Promise<string | null> {
  if (response.status !== 404) return `expected 404 for a foreign resource, got ${response.status}`;
  const body = (await response.json()) as ErrorEnvelope;
  return body.error.code === 'SM-CORE-404-002'
    ? null
    : `expected SM-CORE-404-002, got ${body.error.code}`;
}
