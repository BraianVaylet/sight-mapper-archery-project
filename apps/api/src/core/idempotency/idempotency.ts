import { createHash } from 'node:crypto';
import type { Temporal } from '@js-temporal/polyfill';
import type { Context, MiddlewareHandler } from 'hono';
import type { Clock } from '../clock/clock.js';
import type { AppBindings } from '../http/context.js';
import { AppError } from '../http/errors.js';

export const IDEMPOTENCY_TTL_HOURS = 24;

/** Headers worth replaying: the new version and where the resource lives. */
const REPLAYED_HEADERS = ['etag', 'location'] as const;

const KEY_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;

export type IdempotencyRecord = {
  readonly userId: string;
  readonly key: string;
  readonly method: string;
  readonly path: string;
  readonly requestHash: string;
  readonly statusCode: number;
  readonly responseBody: string;
  readonly responseHeaders: Readonly<Record<string, string>>;
  readonly createdAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
};

export type IdempotencyStore = {
  find(userId: string, key: string): Promise<IdempotencyRecord | null>;
  /** Saving a key that already exists is not an error: the first response wins. */
  save(record: IdempotencyRecord): Promise<void>;
};

/**
 * `Idempotency-Key` on every POST (ADR-006). The same key with the same request replays the
 * stored response instead of running the handler again, so a retry after a lost response never
 * creates a second document. The same key with a different request is a client bug: 409.
 *
 * Only 2xx responses are stored: a failure must stay retryable. Two identical requests racing
 * before either finishes are settled by the unique id (`SM-CORE-409-002`), and the retry replays.
 * Runs after the session middleware: the key belongs to the signed-in user.
 */
export function idempotency(deps: {
  readonly store: IdempotencyStore;
  readonly clock: Clock;
}): MiddlewareHandler<AppBindings> {
  const { store, clock } = deps;

  return async (c, next) => {
    if (c.req.method !== 'POST') return next();

    const userId = c.get('userId');
    if (userId === undefined) throw new AppError('SM-CORE-401-001');

    const key = c.req.header('Idempotency-Key');
    if (key === undefined) throw new AppError('SM-CORE-428-001', { header: 'Idempotency-Key' });
    if (!KEY_FORMAT.test(key)) {
      throw new AppError('SM-CORE-400-001', {
        issues: [
          {
            path: ['header', 'Idempotency-Key'],
            messageKey: 'validation.invalid_format',
            params: { format: 'idempotency-key' },
          },
        ],
      });
    }

    const requestHash = await hashRequest(c);
    const previous = await store.find(userId, key);
    if (previous !== null) {
      if (previous.requestHash !== requestHash) throw new AppError('SM-CORE-409-001');
      c.header('Idempotent-Replay', 'true');
      for (const [name, value] of Object.entries(previous.responseHeaders)) c.header(name, value);
      return c.body(previous.responseBody, previous.statusCode as 200, {
        'Content-Type': 'application/json',
      });
    }

    await next();

    if (c.res.status >= 200 && c.res.status < 300) {
      const now = clock.now();
      await store.save({
        userId,
        key,
        method: c.req.method,
        path: c.req.path,
        requestHash,
        statusCode: c.res.status,
        responseBody: await c.res.clone().text(),
        responseHeaders: pickHeaders(c.res.headers),
        createdAt: now,
        expiresAt: now.add({ hours: IDEMPOTENCY_TTL_HOURS }),
      });
    }
  };
}

function pickHeaders(headers: Headers): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of REPLAYED_HEADERS) {
    const value = headers.get(name);
    if (value !== null) picked[name] = value;
  }
  return picked;
}

/** Method, path and body, with JSON normalised so spacing and key order do not matter. */
async function hashRequest(c: Context<AppBindings>): Promise<string> {
  const text = await c.req.text();
  let canonical = text;
  try {
    canonical = canonicalJson(JSON.parse(text) as unknown);
  } catch {
    // Not JSON (an action POST with no body): the raw text is the canonical form.
  }
  return createHash('sha256').update(`${c.req.method} ${c.req.path}\n${canonical}`).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
