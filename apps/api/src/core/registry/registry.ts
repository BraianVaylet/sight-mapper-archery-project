import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { AppBindings } from '../http/context.js';

/** `session` routes need a signed-in user and are covered by the isolation suite (ADR-000). */
export type RouteAuth = 'public' | 'session';

export type RegisteredRoute = {
  readonly method: string;
  /** OpenAPI path, e.g. `/api/v1/bows/{id}`. */
  readonly path: string;
  readonly auth: RouteAuth;
};

export type RouteRegistry = {
  readonly routes: readonly RegisteredRoute[];
  register<R extends RouteConfig>(
    route: R,
    handler: RouteHandler<R, AppBindings>,
    meta: { readonly auth: RouteAuth },
  ): void;
};

/**
 * Every route goes through here, so the OpenAPI document and the isolation suite are built from
 * the same list: a route nobody registered does not exist (TECNICO §10).
 */
export function createRouteRegistry(app: OpenAPIHono<AppBindings>): RouteRegistry {
  const routes: RegisteredRoute[] = [];
  return {
    routes,
    register(route, handler, meta) {
      app.openapi(route, handler);
      routes.push({ method: route.method.toUpperCase(), path: route.path, auth: meta.auth });
    },
  };
}
