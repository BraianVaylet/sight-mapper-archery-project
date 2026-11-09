import type { ErrorEnvelope } from '@sight-mapper/types';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '../src/composition-root.js';
import { fixedClock } from '../src/core/clock/clock.js';
import { connectMongo } from '../src/core/db/connection.js';
import { createLogger } from '../src/core/logger/logger.js';
import { productionAttacks } from './attacks/index.js';
import { fakeSession, testEnv } from './helpers/app.js';
import { checkIsolation } from './helpers/isolation.js';
import { startReplSet } from './helpers/mongo.js';

let replSet: MongoMemoryReplSet;
let connection: Connection;
let container: ReturnType<typeof createContainer>;

beforeAll(async () => {
  replSet = await startReplSet();
  const logger = createLogger({ level: 'silent' });
  connection = await connectMongo(replSet.getUri('sightmapper_account'), logger);
  container = createContainer({
    env: testEnv,
    logger,
    connection,
    session: fakeSession,
    clock: fixedClock('2026-11-02T12:00:00Z'),
  });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

let counter = 0;
const newUser = () => `account-user-${(counter += 1)}`;

const call = (
  user: string | null,
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
) =>
  Promise.resolve(
    container.app.request(path, {
      method,
      headers: {
        ...(user === null ? {} : { 'x-test-user': user }),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    }),
  );

const patch = (user: string, body: unknown, version: number | null = 1) =>
  call(user, 'PATCH', '/api/v1/me/preferences', {
    body,
    headers: version === null ? {} : { 'if-match': `"${version}"` },
  });

const errorOf = async (response: Response) => ((await response.json()) as ErrorEnvelope).error;

describe('GET /me', () => {
  it('creates the profile with defaults from the browser language and sends its ETag', async () => {
    const response = await call(newUser(), 'GET', '/api/v1/me', {
      headers: { 'accept-language': 'en-GB,en;q=0.9' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(await response.json()).toEqual({
      locale: 'en',
      unitSystem: 'imperial',
      theme: 'system',
      quickAccess: null,
      deletionRequestedAt: null,
      purgeAt: null,
      version: 1,
    });
  });

  it('defaults to Spanish and metric, and never exposes the user id', async () => {
    const body = (await (await call(newUser(), 'GET', '/api/v1/me')).json()) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ locale: 'es', unitSystem: 'metric' });
    expect(body).not.toHaveProperty('userId');
  });

  it('answers the same profile every time: one per archer', async () => {
    const user = newUser();
    await call(user, 'GET', '/api/v1/me');
    await call(user, 'GET', '/api/v1/me', { headers: { 'accept-language': 'en' } });
    expect(await connection.db?.collection('profiles').countDocuments({ userId: user })).toBe(1);
  });

  it('needs a session', async () => {
    const response = await call(null, 'GET', '/api/v1/me');
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe('SM-CORE-401-001');
  });
});

describe('PATCH /me/preferences', () => {
  it('changes only what was sent, bumps the version and sends the new ETag', async () => {
    const user = newUser();
    await call(user, 'GET', '/api/v1/me');
    const response = await patch(user, { theme: 'dark' });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await response.json()).toMatchObject({
      theme: 'dark',
      locale: 'es',
      unitSystem: 'metric',
      version: 2,
    });
  });

  it('changes several at once, and the next GET agrees', async () => {
    const user = newUser();
    await call(user, 'GET', '/api/v1/me');
    await patch(user, { locale: 'en', unitSystem: 'imperial', theme: 'light' });
    expect(await (await call(user, 'GET', '/api/v1/me')).json()).toMatchObject({
      locale: 'en',
      unitSystem: 'imperial',
      theme: 'light',
      version: 2,
    });
  });

  it('works on an archer whose profile does not exist yet', async () => {
    const response = await patch(newUser(), { theme: 'light' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ theme: 'light', version: 2 });
  });

  it('refuses a stale version with 412 and the current one, and changes nothing', async () => {
    const user = newUser();
    await call(user, 'GET', '/api/v1/me');
    await patch(user, { theme: 'dark' });
    const stale = await patch(user, { theme: 'light' }, 1);
    expect(stale.status).toBe(412);
    expect(await errorOf(stale)).toMatchObject({
      code: 'SM-CORE-412-001',
      params: { currentVersion: 2 },
    });
    expect(await (await call(user, 'GET', '/api/v1/me')).json()).toMatchObject({ theme: 'dark' });
  });

  it('refuses a write that did not say which version it saw (428)', async () => {
    const response = await patch(newUser(), { theme: 'dark' }, null);
    expect(response.status).toBe(428);
  });

  it.each([
    ['an empty body', {}, 'validation.preferences.empty'],
    ['a value that does not exist', { theme: 'neon' }, 'validation.invalid_value'],
    ['an unsupported language', { locale: 'fr' }, 'validation.invalid_value'],
  ])('rejects %s with the keys of what is wrong', async (_name, body, key) => {
    const response = await patch(newUser(), body);
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe('SM-CORE-400-001');
    expect(JSON.stringify(error.params)).toContain(key);
  });

  it('needs a session', async () => {
    const response = await call(null, 'PATCH', '/api/v1/me/preferences', {
      body: { theme: 'dark' },
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(401);
  });
});

describe('isolation of the account routes (spec 13)', () => {
  it('keeps one archer out of reach of another, route by route', async () => {
    expect(
      await checkIsolation(container.app, container.registry.routes, productionAttacks),
    ).toEqual([]);
  });
});
