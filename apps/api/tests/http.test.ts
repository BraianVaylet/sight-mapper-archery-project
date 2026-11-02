import { createRoute, z } from '@hono/zod-openapi';
import type { ErrorEnvelope } from '@sight-mapper/types';
import { describe, expect, it } from 'vitest';
import { createContainer } from '../src/composition-root.js';
import { fixedClock } from '../src/core/clock/clock.js';
import type { Env } from '../src/core/config/env.js';
import { AppError } from '../src/core/http/errors.js';
import { createLogger } from '../src/core/logger/logger.js';

const baseEnv: Env = {
  NODE_ENV: 'test',
  APP_ENV: 'local',
  PORT: 3000,
  MONGODB_URI: 'mongodb://localhost/test',
  BETTER_AUTH_SECRET: 't'.repeat(40),
  BETTER_AUTH_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  RESEND_API_KEY: undefined,
  EMAIL_FROM: undefined,
  CORS_ORIGINS: ['http://localhost:5173'],
  LOG_LEVEL: 'debug',
};

type LogLine = Record<string, unknown>;

function build(overrides: { env?: Partial<Env>; readiness?: { check(): Promise<void> } } = {}) {
  const lines: LogLine[] = [];
  const logger = createLogger(
    { level: 'debug' },
    { write: (line: string) => void lines.push(JSON.parse(line) as LogLine) },
  );
  const container = createContainer({
    env: { ...baseEnv, ...overrides.env },
    logger,
    clock: fixedClock('2026-10-30T12:00:00Z'),
    ...(overrides.readiness === undefined ? {} : { readiness: overrides.readiness }),
  });

  const body = z.object({ name: z.string().min(1).max(5), age: z.number().int() });
  container.registry.register(
    createRoute({
      method: 'post',
      path: '/test/echo',
      request: { body: { content: { 'application/json': { schema: body } } } },
      responses: { 200: { description: 'ok', content: { 'application/json': { schema: body } } } },
    }),
    (c) => c.json(c.req.valid('json'), 200),
    { auth: 'public' },
  );
  const simple = (path: string, handler: () => never) =>
    container.registry.register(
      createRoute({
        method: 'get',
        path,
        responses: {
          200: { description: 'ok', content: { 'application/json': { schema: z.object({}) } } },
        },
      }),
      handler as never,
      { auth: 'public' },
    );
  simple('/test/boom', () => {
    throw new Error('database password is hunter2');
  });
  simple('/test/forbidden-resource', () => {
    throw new AppError('SM-CORE-404-002', { resource: 'bow' });
  });
  simple('/test/unauthenticated', () => {
    throw new AppError('SM-CORE-401-001');
  });
  simple('/test/stale', () => {
    throw new AppError('SM-CORE-412-001', { currentVersion: 4 });
  });

  return { ...container, lines };
}

const envelope = async (res: Response) => (await res.json()) as ErrorEnvelope;
const json = (payload: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(payload),
});

describe('health and readiness', () => {
  it('/health is 200 even when a dependency is down', async () => {
    const { app } = build({ readiness: { check: () => Promise.reject(new Error('mongo down')) } });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('/ready is 200 when everything answers', async () => {
    const { app } = build();
    const res = await app.request('/ready');
    expect(res.status).toBe(200);
  });

  it('/ready is 503 SM-CORE-503-001 when Mongo is down, without leaking the cause', async () => {
    const { app } = build({
      readiness: { check: () => Promise.reject(new Error('mongo down at 10.0.0.5')) },
    });
    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const body = await envelope(res);
    expect(body.error.code).toBe('SM-CORE-503-001');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it('keeps probe traffic out of the info log', async () => {
    const { app, lines } = build();
    await app.request('/health');
    expect(lines.filter((l) => l['level'] === 30)).toHaveLength(0);
  });
});

describe('error envelope', () => {
  it('turns any Error into SM-CORE-500-001 without stack or message, and logs the stack', async () => {
    const { app, lines } = build();
    const res = await app.request('/test/boom');
    expect(res.status).toBe(500);
    const body = await envelope(res);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'SM-CORE-500-001',
        messageKey: 'errors.core.unexpected',
        params: {},
        requestId: res.headers.get('x-request-id'),
        timestamp: '2026-10-30T12:00:00Z',
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/hunter2|stack|at /);

    const logged = lines.find((l) => l['level'] === 50);
    expect(logged).toMatchObject({ msg: 'request failed', code: 'SM-CORE-500-001' });
    expect(logged?.['requestId']).toBe(body.error.requestId);
    expect(JSON.stringify(logged?.['err'])).toContain('hunter2');
    expect(JSON.stringify(logged?.['err'])).toContain('stack');
  });

  it('answers an AppError with its status, key and params', async () => {
    const { app } = build();
    const res = await app.request('/test/stale');
    expect(res.status).toBe(412);
    expect((await envelope(res)).error).toMatchObject({
      code: 'SM-CORE-412-001',
      messageKey: 'errors.core.staleWrite',
      params: { currentVersion: 4 },
    });
  });

  it('logs 401 and 404 as info, other 4xx as warn, and no stack', async () => {
    const { app, lines } = build();
    await app.request('/test/unauthenticated');
    await app.request('/test/forbidden-resource');
    await app.request('/test/stale');
    const byCode = (code: string) => lines.find((l) => l['code'] === code);
    expect(byCode('SM-CORE-401-001')?.['level']).toBe(30);
    expect(byCode('SM-CORE-404-002')?.['level']).toBe(30);
    expect(byCode('SM-CORE-412-001')?.['level']).toBe(40);
    expect(byCode('SM-CORE-412-001')).not.toHaveProperty('err');
  });

  it('answers an unknown route with SM-CORE-404-001', async () => {
    const { app } = build();
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect((await envelope(res)).error.code).toBe('SM-CORE-404-001');
  });
});

describe('request id', () => {
  it('echoes a valid UUID and generates one otherwise', async () => {
    const { app } = build();
    const mine = '019a3c5e-1111-7222-8333-444455556666';
    const echoed = await app.request('/health', { headers: { 'X-Request-Id': mine } });
    expect(echoed.headers.get('x-request-id')).toBe(mine);

    const replaced = await app.request('/health', { headers: { 'X-Request-Id': 'not-a-uuid' } });
    const generated = replaced.headers.get('x-request-id') ?? '';
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('puts the same id in the response header, the envelope and the logs', async () => {
    const { app, lines } = build();
    const res = await app.request('/nope');
    const id = res.headers.get('x-request-id');
    expect((await envelope(res)).error.requestId).toBe(id);
    expect(lines.every((l) => l['requestId'] === id)).toBe(true);
  });
});

describe('body rules', () => {
  it('rejects a 100 KB body with SM-CORE-413-001', async () => {
    const { app } = build();
    const res = await app.request('/test/echo', json({ name: 'x'.repeat(100 * 1024), age: 1 }));
    expect(res.status).toBe(413);
    const body = await envelope(res);
    expect(body.error).toMatchObject({ code: 'SM-CORE-413-001', params: { maxBytes: 65536 } });
  });

  it('rejects a body that is not JSON with SM-CORE-415-001', async () => {
    const { app } = build();
    const res = await app.request('/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'name=x',
    });
    expect(res.status).toBe(415);
    expect((await envelope(res)).error.code).toBe('SM-CORE-415-001');
  });

  it('lets a body-less action POST through when the server frames it with a stream (found by the E2E)', async () => {
    const { app } = build();
    // What a browser sends for `POST /x/archive`: an empty stream and `Content-Length: 0`, no type.
    const res = await app.request('/test/action', {
      method: 'POST',
      headers: { 'content-length': '0' },
      body: '',
    });
    expect(res.status).toBe(404);
    expect((await envelope(res)).error.code).toBe('SM-CORE-404-001');
  });

  it('still rejects a non-JSON body that does declare a length', async () => {
    const { app } = build();
    const res = await app.request('/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'content-length': '6' },
      body: 'name=x',
    });
    expect(res.status).toBe(415);
  });

  it('lets an action POST without a body through (archive, restore)', async () => {
    const { app } = build();
    const res = await app.request('/test/action', { method: 'POST' });
    expect(res.status).toBe(404);
    expect((await envelope(res)).error.code).toBe('SM-CORE-404-001');
  });

  it('turns a Zod failure into SM-CORE-400-001 with one issue per field', async () => {
    const { app } = build();
    const res = await app.request('/test/echo', json({ name: 'toolongname', age: 1.5 }));
    expect(res.status).toBe(400);
    const body = await envelope(res);
    expect(body.error.code).toBe('SM-CORE-400-001');
    const issues = body.error.params['issues'] as { path: string[]; messageKey: string }[];
    expect(issues.map((i) => i.path.join('.')).sort()).toEqual(['age', 'name']);
    expect(issues.every((i) => i.messageKey.startsWith('validation.'))).toBe(true);
  });

  it('treats malformed JSON as a validation error', async () => {
    const { app } = build();
    const res = await app.request('/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    expect((await envelope(res)).error.code).toBe('SM-CORE-400-001');
  });

  it('accepts a valid body', async () => {
    const { app } = build();
    const res = await app.request('/test/echo', json({ name: 'ok', age: 3 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'ok', age: 3 });
  });
});

describe('security headers and CORS', () => {
  it('sets the standard security headers', async () => {
    const { app } = build();
    const res = await app.request('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBeTruthy();
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
  });

  it('echoes only an allowed origin and allows credentials', async () => {
    const { app } = build();
    const ok = await app.request('/health', { headers: { Origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true');

    const evil = await app.request('/health', { headers: { Origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers a preflight with the headers the client uses', async () => {
    const { app } = build();
    const res = await app.request('/api/v1/anything', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PATCH' },
    });
    expect(res.headers.get('access-control-allow-headers')).toContain('If-Match');
    expect(res.headers.get('access-control-allow-headers')).toContain('Idempotency-Key');
    expect(res.headers.get('access-control-allow-methods')).toContain('PATCH');
  });
});

describe('OpenAPI and the route registry', () => {
  it('serves the document outside production, built from the registry', async () => {
    const { app, registry } = build();
    const res = await app.request('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/health', '/ready', '/test/echo']),
    );
    expect(registry.routes).toContainEqual({ method: 'GET', path: '/health', auth: 'public' });
  });

  it('hides it in production', async () => {
    const { app } = build({ env: { APP_ENV: 'prod' } });
    const res = await app.request('/api/v1/openapi.json');
    expect(res.status).toBe(404);
  });
});
