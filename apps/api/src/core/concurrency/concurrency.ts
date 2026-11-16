import type { Context, MiddlewareHandler } from 'hono';
import type { AppBindings } from '../http/context.js';
import { AppError } from '../http/errors.js';

const WRITE_METHODS = new Set(['PATCH', 'PUT', 'DELETE']);
const IF_MATCH = /^"(\d+)"$/;

/** `"3"`: a strong validator, the resource `version` between quotes (TECNICO §4). */
export function etagOf(version: number): string {
  return `"${version}"`;
}

/** Puts the `ETag` of a resource on the response. */
export function setEtag(c: Context<AppBindings>, resource: { readonly version: number }): void {
  c.header('ETag', etagOf(resource.version));
}

/**
 * PATCH, PUT and DELETE must say which version they saw (`If-Match`), so a stale write fails with
 * 412 instead of overwriting someone else's change (ADR-006). A missing header is 428; a header
 * that is not one of our ETags cannot match anything, so it is a stale write too.
 *
 * `exempt` lists `METHOD path` pairs for actions that have no versioned resource.
 */
export function ifMatchGuard(exempt: readonly string[] = []): MiddlewareHandler<AppBindings> {
  const skip = new Set(exempt);
  return async (c, next) => {
    if (!WRITE_METHODS.has(c.req.method) || skip.has(`${c.req.method} ${c.req.path}`)) {
      return next();
    }
    const header = c.req.header('If-Match');
    if (header === undefined) throw new AppError('SM-CORE-428-001', { header: 'If-Match' });

    const match = IF_MATCH.exec(header.trim());
    if (match === null) throw new AppError('SM-CORE-412-001', { currentVersion: null });
    c.set('ifMatch', Number(match[1]));
    await next();
  };
}

/** The version the client sent. Only valid behind `ifMatchGuard`. */
export function expectedVersion(c: Context<AppBindings>): number {
  const version = c.get('ifMatch');
  if (version === undefined) throw new AppError('SM-CORE-428-001', { header: 'If-Match' });
  return version;
}
