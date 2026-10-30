import { createRoute, z } from '@hono/zod-openapi';
import type { ErrorEnvelope } from '@sight-mapper/types';
import type { MiddlewareHandler } from 'hono';
import { createContainer } from '../../src/composition-root.js';
import { fixedClock } from '../../src/core/clock/clock.js';
import type { Env } from '../../src/core/config/env.js';
import { expectedVersion, setEtag } from '../../src/core/concurrency/concurrency.js';
import { AppError } from '../../src/core/http/errors.js';
import type { AppBindings } from '../../src/core/http/context.js';
import type {
  IdempotencyRecord,
  IdempotencyStore,
} from '../../src/core/idempotency/idempotency.js';
import { createLogger } from '../../src/core/logger/logger.js';

export const testEnv: Env = {
  NODE_ENV: 'test',
  APP_ENV: 'local',
  PORT: 3000,
  MONGODB_URI: 'mongodb://localhost/test',
  CORS_ORIGINS: [],
  LOG_LEVEL: 'silent',
};

/** Stands in for the session middleware: the user is whoever the test header says. */
export const fakeSession: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = c.req.header('x-test-user');
  if (user !== undefined) c.set('userId', user);
  await next();
};

export function memoryIdempotencyStore(): IdempotencyStore & { records: IdempotencyRecord[] } {
  const records: IdempotencyRecord[] = [];
  return {
    records,
    find: (userId, key) =>
      Promise.resolve(records.find((r) => r.userId === userId && r.key === key) ?? null),
    save(record) {
      if (!records.some((r) => r.userId === record.userId && r.key === record.key)) {
        records.push(record);
      }
      return Promise.resolve();
    },
  };
}

export const envelope = async (res: Response) => (await res.json()) as ErrorEnvelope;

/** A tiny versioned collection behind /api/v1/things, to exercise POST/PATCH/DELETE rules. */
export function buildThingsApp(overrides: { ifMatchExempt?: readonly string[] } = {}) {
  const store = memoryIdempotencyStore();
  const things = new Map<string, { id: string; name: string; version: number }>();
  const container = createContainer({
    env: testEnv,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock('2026-10-30T12:00:00Z'),
    session: fakeSession,
    idempotencyStore: store,
    ...(overrides.ifMatchExempt === undefined ? {} : { ifMatchExempt: overrides.ifMatchExempt }),
  });

  const body = z.object({ id: z.string(), name: z.string().min(1) });
  const resource = z.object({ id: z.string(), name: z.string(), version: z.number() });
  const json = <S extends z.ZodType>(schema: S) => ({ 'application/json': { schema } });

  container.registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/things',
      request: { body: { content: json(body) } },
      responses: { 201: { description: 'created', content: json(resource) } },
    }),
    (c) => {
      const input = c.req.valid('json');
      const thing = { ...input, version: 1 };
      things.set(thing.id, thing);
      setEtag(c, thing);
      c.header('Location', `/api/v1/things/${thing.id}`);
      return c.json(thing, 201);
    },
    { auth: 'session' },
  );

  container.registry.register(
    createRoute({
      method: 'patch',
      path: '/api/v1/things/{id}',
      request: {
        params: z.object({ id: z.string() }),
        body: { content: json(z.object({ name: z.string().min(1) })) },
      },
      responses: { 200: { description: 'ok', content: json(resource) } },
    }),
    (c) => {
      const { id } = c.req.valid('param');
      const thing = things.get(id);
      if (thing === undefined) throw new AppError('SM-CORE-404-002', { resource: 'thing' });
      if (expectedVersion(c) !== thing.version) {
        throw new AppError('SM-CORE-412-001', { currentVersion: thing.version });
      }
      thing.name = c.req.valid('json').name;
      thing.version += 1;
      setEtag(c, thing);
      return c.json(thing, 200);
    },
    { auth: 'session' },
  );

  container.registry.register(
    createRoute({
      method: 'delete',
      path: '/api/v1/things/{id}',
      request: { params: z.object({ id: z.string() }) },
      responses: { 204: { description: 'deleted' } },
    }),
    (c) => {
      things.delete(c.req.valid('param').id);
      return c.body(null, 204);
    },
    { auth: 'session' },
  );

  return { ...container, things, store };
}
