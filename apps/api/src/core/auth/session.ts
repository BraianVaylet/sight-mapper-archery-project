import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../http/context.js';
import { AppError } from '../http/errors.js';

/** The slice of Better Auth the session middleware needs. */
export type SessionReader = {
  getSession(headers: Headers): Promise<{ user: { id: string } } | null>;
};

/** Paths under /api/v1 that need no session. */
const PUBLIC = new Set(['/api/v1/openapi.json']);

/**
 * Turns the session cookie into `userId` (ADR-000): the only place an identity enters the request.
 * No valid session is `SM-CORE-401-001`, whatever the route. The id is never read from the body,
 * the query or the path.
 */
export function sessionMiddleware(reader: SessionReader): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    if (PUBLIC.has(c.req.path)) return next();
    const session = await reader.getSession(c.req.raw.headers);
    if (session === null) throw new AppError('SM-CORE-401-001');
    c.set('userId', session.user.id);
    await next();
  };
}
