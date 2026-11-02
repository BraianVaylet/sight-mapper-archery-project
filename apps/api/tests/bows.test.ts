import { Temporal } from '@js-temporal/polyfill';
import type { ErrorEnvelope } from '@sight-mapper/types';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '../src/composition-root.js';
import type { Clock } from '../src/core/clock/clock.js';
import { connectMongo } from '../src/core/db/connection.js';
import { createMongoIdempotencyStore } from '../src/core/idempotency/mongo-store.js';
import { createLogger } from '../src/core/logger/logger.js';
import { productionAttacks } from './attacks/index.js';
import { fakeSession, testEnv } from './helpers/app.js';
import { checkIsolation } from './helpers/isolation.js';
import { startReplSet } from './helpers/mongo.js';

let replSet: MongoMemoryReplSet;
let connection: Connection;
let container: ReturnType<typeof createContainer>;

/** A clock the tests move: lists are ordered by last edit. */
let now = Temporal.Instant.from('2026-11-02T12:00:00Z');
const clock: Clock = { now: () => now };
const tick = () => void (now = now.add({ seconds: 1 }));

/** What the calculator will answer once it exists: here, a bow can be "in use" on demand. */
const usageByBow = new Map<string, { setups: number; marks: number }>();

beforeAll(async () => {
  replSet = await startReplSet();
  const logger = createLogger({ level: 'silent' });
  connection = await connectMongo(replSet.getUri('sightmapper_bows'), logger);
  container = createContainer({
    env: testEnv,
    logger,
    connection,
    clock,
    session: fakeSession,
    idempotencyStore: createMongoIdempotencyStore(connection, clock),
    componentUsage: {
      bowUsage: (_userId, bowId) =>
        Promise.resolve(usageByBow.get(bowId) ?? { setups: 0, marks: 0 }),
    },
  });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

let counter = 0;
const newUser = () => `bow-user-${(counter += 1)}`;

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
        ...(method === 'POST' ? { 'idempotency-key': uuidv7() } : {}),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    }),
  );

const HOYT = { bowType: 'compound', manufacturer: 'Hoyt', model: 'Alpha' };

async function addBow(user: string, fields: Record<string, unknown> = {}) {
  const id = uuidv7();
  const response = await call(user, 'POST', '/api/v1/bows', { body: { id, ...HOYT, ...fields } });
  expect(response.status).toBe(201);
  return id;
}

const bodyOf = async <T = Record<string, unknown>>(response: Response) =>
  (await response.json()) as T;
const errorOf = async (response: Response) => (await bodyOf<ErrorEnvelope>(response)).error;
const patch = (user: string, id: string, body: unknown, version: number | null = 1) =>
  call(user, 'PATCH', `/api/v1/bows/${id}`, {
    body,
    headers: version === null ? {} : { 'if-match': `"${version}"` },
  });
const ids = async (response: Response) =>
  (await bodyOf<{ items: { id: string }[] }>(response)).items.map((bow) => bow.id);

describe('POST /bows', () => {
  it('adds a bow, answers it with its ETag, and shows it in the list and the detail', async () => {
    const user = newUser();
    const id = uuidv7();
    const response = await call(user, 'POST', '/api/v1/bows', {
      body: { id, ...HOYT, letOffPct: 80, drawLengthMm: 711, braceHeightMm: 158.75 },
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    const created = await bodyOf(response);
    expect(created).toMatchObject({
      id,
      ...HOYT,
      letOffPct: 80,
      braceHeightMm: 158.75,
      status: 'active',
      version: 1,
      deletedAt: null,
    });
    expect(created).not.toHaveProperty('userId');

    expect(await ids(await call(user, 'GET', '/api/v1/bows'))).toEqual([id]);
    expect(await bodyOf(await call(user, 'GET', `/api/v1/bows/${id}`))).toMatchObject({
      id,
      usage: { setups: 0, marks: 0 },
    });
  });

  it('is idempotent: the same key three times makes one bow and the same answer', async () => {
    const user = newUser();
    const key = uuidv7();
    const body = { id: uuidv7(), ...HOYT };
    const answers = [];
    for (let i = 0; i < 3; i++) {
      const response = await call(user, 'POST', '/api/v1/bows', {
        body,
        headers: { 'idempotency-key': key },
      });
      expect(response.status).toBe(201);
      answers.push(await response.text());
    }
    expect(new Set(answers).size).toBe(1);
    expect(await connection.db?.collection('bows').countDocuments({ userId: user })).toBe(1);
  });

  it('refuses an id that exists with 409, whatever key it comes with', async () => {
    const user = newUser();
    const id = await addBow(user);
    const again = await call(user, 'POST', '/api/v1/bows', { body: { id, ...HOYT } });
    expect(again.status).toBe(409);
    expect((await errorOf(again)).code).toBe('SM-CORE-409-002');
  });

  it('accepts only compound bows for now (SM-BOW-422-001)', async () => {
    const response = await call(newUser(), 'POST', '/api/v1/bows', {
      body: { id: uuidv7(), bowType: 'recurve', model: 'Formula' },
    });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: 'SM-BOW-422-001',
      params: { bowType: 'recurve' },
    });
  });

  it.each([
    ['no manufacturer and no model', { manufacturer: undefined, model: undefined }, 'manufacturer'],
    ['a let-off over 99 %', { letOffPct: 120 }, 'letOffPct'],
    ['a draw weight below the range', { drawWeightN: 5 }, 'drawWeightN'],
    ['an unknown cam', { camType: 'round' }, 'camType'],
  ])('rejects %s, naming the field', async (_name, fields, field) => {
    const response = await call(newUser(), 'POST', '/api/v1/bows', {
      body: { id: uuidv7(), ...HOYT, ...fields },
    });
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe('SM-CORE-400-001');
    expect(JSON.stringify(error.params)).toContain(field);
  });

  it('needs a session', async () => {
    const response = await call(null, 'POST', '/api/v1/bows', { body: { id: uuidv7(), ...HOYT } });
    expect(response.status).toBe(401);
  });
});

describe('GET /bows', () => {
  it('lists newest edit first, active by default, archived on request', async () => {
    const user = newUser();
    const first = await addBow(user);
    tick();
    const second = await addBow(user);
    tick();
    const archived = await addBow(user);
    await call(user, 'POST', `/api/v1/bows/${archived}/archive`);

    expect(await ids(await call(user, 'GET', '/api/v1/bows'))).toEqual([second, first]);
    expect(await ids(await call(user, 'GET', '/api/v1/bows?status=archived'))).toEqual([archived]);
  });

  it('pages with an opaque cursor and never repeats or skips a bow', async () => {
    const user = newUser();
    const made: string[] = [];
    for (let i = 0; i < 5; i++) {
      tick();
      made.push(await addBow(user));
    }
    const newestFirst = [...made].reverse();

    const one = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(
      await call(user, 'GET', '/api/v1/bows?limit=2'),
    );
    expect(one.items.map((b) => b.id)).toEqual(newestFirst.slice(0, 2));
    expect(one.nextCursor).not.toBeNull();

    const two = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(
      await call(user, 'GET', `/api/v1/bows?limit=2&cursor=${one.nextCursor}`),
    );
    expect(two.items.map((b) => b.id)).toEqual(newestFirst.slice(2, 4));

    const three = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(
      await call(user, 'GET', `/api/v1/bows?limit=2&cursor=${two.nextCursor}`),
    );
    expect(three.items.map((b) => b.id)).toEqual(newestFirst.slice(4));
    expect(three.nextCursor).toBeNull();
  });

  it('is empty for an archer with no bows, and rejects a cursor it cannot read', async () => {
    const user = newUser();
    expect(await bodyOf(await call(user, 'GET', '/api/v1/bows'))).toEqual({
      items: [],
      nextCursor: null,
    });
    const bad = await call(user, 'GET', '/api/v1/bows?cursor=not-a-cursor');
    expect(bad.status).toBe(400);
  });
});

describe('GET /bows/:id', () => {
  it('says how many setups and marks use the bow', async () => {
    const user = newUser();
    const id = await addBow(user);
    usageByBow.set(id, { setups: 2, marks: 14 });
    expect(await bodyOf(await call(user, 'GET', `/api/v1/bows/${id}`))).toMatchObject({
      usage: { setups: 2, marks: 14 },
    });
  });

  it('is a 404 for a bow that does not exist', async () => {
    const response = await call(newUser(), 'GET', `/api/v1/bows/${uuidv7()}`);
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe('SM-CORE-404-002');
  });
});

describe('PATCH /bows/:id', () => {
  it('changes only what was sent, bumps the version and the ETag, and moves it to the top', async () => {
    const user = newUser();
    const id = await addBow(user, { letOffPct: 80 });
    tick();
    const other = await addBow(user);
    tick();
    const response = await patch(user, id, { drawLengthMm: 700 });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await bodyOf(response)).toMatchObject({
      ...HOYT,
      letOffPct: 80,
      drawLengthMm: 700,
      version: 2,
    });
    expect(await ids(await call(user, 'GET', '/api/v1/bows'))).toEqual([id, other]);
  });

  it('clears a field with null', async () => {
    const user = newUser();
    const id = await addBow(user, { letOffPct: 80 });
    const body = await bodyOf(await patch(user, id, { letOffPct: null }));
    expect(body).not.toHaveProperty('letOffPct');
  });

  it('refuses a stale version with 412, and changes nothing', async () => {
    const user = newUser();
    const id = await addBow(user);
    await patch(user, id, { nickname: 'first' });
    const stale = await patch(user, id, { nickname: 'second' }, 1);
    expect(stale.status).toBe(412);
    expect(await errorOf(stale)).toMatchObject({
      code: 'SM-CORE-412-001',
      params: { currentVersion: 2 },
    });
    expect(await bodyOf(await call(user, 'GET', `/api/v1/bows/${id}`))).toMatchObject({
      nickname: 'first',
    });
  });

  it('wants the version it saw: without If-Match it is 428', async () => {
    const user = newUser();
    expect((await patch(user, await addBow(user), { nickname: 'x' }, null)).status).toBe(428);
  });

  it('keeps a name: clearing both manufacturer and model is a 400 on the manufacturer', async () => {
    const user = newUser();
    const id = await addBow(user);
    const response = await patch(user, id, { manufacturer: null, model: null });
    expect(response.status).toBe(400);
    expect(JSON.stringify((await errorOf(response)).params)).toContain(
      'validation.equipment.manufacturerOrModel',
    );
    // Clearing one of the two is fine.
    expect((await patch(user, id, { manufacturer: null })).status).toBe(200);
  });

  it('cannot turn a compound bow into one the product does not support yet', async () => {
    const user = newUser();
    const response = await patch(user, await addBow(user), { bowType: 'crossbow' });
    expect(response.status).toBe(422);
  });

  it('is a 404 for a bow that does not exist', async () => {
    expect((await patch(newUser(), uuidv7(), { nickname: 'x' })).status).toBe(404);
  });
});

describe('archive and unarchive (ADR-008)', () => {
  it('moves the bow out of the active list and back, and says so in its status', async () => {
    const user = newUser();
    const id = await addBow(user);

    const archived = await call(user, 'POST', `/api/v1/bows/${id}/archive`);
    expect(archived.status).toBe(200);
    expect(await bodyOf(archived)).toMatchObject({ status: 'archived', version: 2 });
    expect(await ids(await call(user, 'GET', '/api/v1/bows'))).toEqual([]);

    const back = await call(user, 'POST', `/api/v1/bows/${id}/unarchive`);
    expect(await bodyOf(back)).toMatchObject({ status: 'active', version: 3 });
    expect(await ids(await call(user, 'GET', '/api/v1/bows'))).toEqual([id]);
  });

  it('keeps the bow reachable by id while it is archived', async () => {
    const user = newUser();
    const id = await addBow(user);
    await call(user, 'POST', `/api/v1/bows/${id}/archive`);
    expect(await bodyOf(await call(user, 'GET', `/api/v1/bows/${id}`))).toMatchObject({
      status: 'archived',
    });
  });

  it('is a 404 for a bow that does not exist', async () => {
    expect((await call(newUser(), 'POST', `/api/v1/bows/${uuidv7()}/archive`)).status).toBe(404);
  });
});

describe('DELETE /bows/:id (ADR-008)', () => {
  it('deletes a bow no setup uses: gone from the list and the detail, kept in the database', async () => {
    const user = newUser();
    const id = await addBow(user);
    const response = await call(user, 'DELETE', `/api/v1/bows/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(204);
    expect(await ids(await call(user, 'GET', '/api/v1/bows'))).toEqual([]);
    expect((await call(user, 'GET', `/api/v1/bows/${id}`)).status).toBe(404);
    const stored = await connection.db?.collection('bows').findOne({ _id: id as never });
    expect(stored?.['deletedAt']).toBeInstanceOf(Date);
  });

  it('refuses a bow that setups use, with how many, so the screen can offer to archive it', async () => {
    const user = newUser();
    const id = await addBow(user);
    usageByBow.set(id, { setups: 2, marks: 14 });
    const response = await call(user, 'DELETE', `/api/v1/bows/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatchObject({
      code: 'SM-BOW-409-001',
      params: { setups: 2, marks: 14 },
    });
    expect((await call(user, 'GET', `/api/v1/bows/${id}`)).status).toBe(200);
    // ...and archiving it is the way out.
    expect((await call(user, 'POST', `/api/v1/bows/${id}/archive`)).status).toBe(200);
  });

  it('refuses a stale version (412) and a missing one (428)', async () => {
    const user = newUser();
    const id = await addBow(user);
    await patch(user, id, { nickname: 'x' });
    const stale = await call(user, 'DELETE', `/api/v1/bows/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(stale.status).toBe(412);
    expect((await call(user, 'DELETE', `/api/v1/bows/${id}`)).status).toBe(428);
  });

  it('is a 404 for a bow that does not exist', async () => {
    const response = await call(newUser(), 'DELETE', `/api/v1/bows/${uuidv7()}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(404);
  });
});

describe('isolation of the bow routes (spec 13)', () => {
  it('keeps one archer out of reach of another, route by route', async () => {
    expect(
      await checkIsolation(container.app, container.registry.routes, productionAttacks),
    ).toEqual([]);
  });
});
