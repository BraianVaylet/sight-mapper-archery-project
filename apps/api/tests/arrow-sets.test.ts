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

let now = Temporal.Instant.from('2026-11-02T12:00:00Z');
const clock: Clock = { now: () => now };
const tick = () => void (now = now.add({ seconds: 1 }));

/** What the calculator will answer once it exists: an arrow set can be "in use" on demand. */
const usageBySet = new Map<string, { setups: number; marks: number }>();

beforeAll(async () => {
  replSet = await startReplSet();
  const logger = createLogger({ level: 'silent' });
  connection = await connectMongo(replSet.getUri('sightmapper_arrows'), logger);
  container = createContainer({
    env: testEnv,
    logger,
    connection,
    clock,
    session: fakeSession,
    idempotencyStore: createMongoIdempotencyStore(connection, clock),
    componentUsage: {
      bowUsage: () => Promise.resolve({ setups: 0, marks: 0 }),
      sightUsage: () => Promise.resolve({ setups: 0, marks: 0 }),
      arrowSetUsage: (_userId, setId) =>
        Promise.resolve(usageBySet.get(setId) ?? { setups: 0, marks: 0 }),
    },
  });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

const BASE = '/api/v1/arrow-sets';
let counter = 0;
const newUser = () => `arrow-user-${(counter += 1)}`;

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

const HUNTER = { name: 'Goldtip Hunter 400', spine: 400 };

async function addSet(user: string, fields: Record<string, unknown> = {}) {
  const id = uuidv7();
  const response = await call(user, 'POST', BASE, { body: { id, ...HUNTER, ...fields } });
  expect(response.status).toBe(201);
  return id;
}

const bodyOf = async <T = Record<string, unknown>>(response: Response) =>
  (await response.json()) as T;
const errorOf = async (response: Response) => (await bodyOf<ErrorEnvelope>(response)).error;
const patch = (user: string, id: string, body: unknown, version: number | null = 1) =>
  call(user, 'PATCH', `${BASE}/${id}`, {
    body,
    headers: version === null ? {} : { 'if-match': `"${version}"` },
  });
const ids = async (response: Response) =>
  (await bodyOf<{ items: { id: string }[] }>(response)).items.map((set) => set.id);

describe('POST /arrow-sets (HU-ARW-01)', () => {
  it('adds a set with only a name, and answers it with its ETag', async () => {
    const user = newUser();
    const id = uuidv7();
    const response = await call(user, 'POST', BASE, { body: { id, name: 'Mis flechas' } });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    const created = await bodyOf(response);
    expect(created).toMatchObject({ id, name: 'Mis flechas', status: 'active', version: 1 });
    expect(created).not.toHaveProperty('userId');
    expect(await ids(await call(user, 'GET', BASE))).toEqual([id]);
    expect(await bodyOf(await call(user, 'GET', `${BASE}/${id}`))).toMatchObject({
      usage: { setups: 0, marks: 0 },
    });
  });

  it('keeps every optional measurement the archer gave, and leaves out the rest', async () => {
    const response = await call(newUser(), 'POST', BASE, {
      body: {
        id: uuidv7(),
        ...HUNTER,
        manufacturer: 'Easton',
        cutLengthMm: 740,
        gpi: 8.5,
        pointWeightG: 5.6,
        vaneCount: 3,
        measuredSpeedMps: 83.2,
      },
    });
    const created = await bodyOf(response);
    expect(created).toMatchObject({
      spine: 400,
      cutLengthMm: 740,
      gpi: 8.5,
      pointWeightG: 5.6,
      vaneCount: 3,
      measuredSpeedMps: 83.2,
    });
    expect(created).not.toHaveProperty('nock');
  });

  it('is idempotent: the same key three times makes one set and the same answer', async () => {
    const user = newUser();
    const key = uuidv7();
    const body = { id: uuidv7(), ...HUNTER };
    const answers = [];
    for (let i = 0; i < 3; i++) {
      const response = await call(user, 'POST', BASE, {
        body,
        headers: { 'idempotency-key': key },
      });
      expect(response.status).toBe(201);
      answers.push(await response.text());
    }
    expect(new Set(answers).size).toBe(1);
    expect(await connection.db?.collection('arrowSets').countDocuments({ userId: user })).toBe(1);
  });

  it('refuses an id that exists with 409', async () => {
    const user = newUser();
    const id = await addSet(user);
    const again = await call(user, 'POST', BASE, { body: { id, name: 'Otra' } });
    expect(again.status).toBe(409);
    expect((await errorOf(again)).code).toBe('SM-CORE-409-002');
  });

  it.each([
    ['no name', { name: undefined }, 'name'],
    ['a blank name', { name: '   ' }, 'name'],
    ['a spine out of range', { spine: 20 }, 'spine'],
    ['a total weight out of range', { totalWeightG: 500 }, 'totalWeightG'],
    ['a vane count that is not a whole number', { vaneCount: 3.5 }, 'vaneCount'],
  ])('rejects %s, naming the field', async (_name, fields, field) => {
    const response = await call(newUser(), 'POST', BASE, {
      body: { id: uuidv7(), ...HUNTER, ...fields },
    });
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe('SM-CORE-400-001');
    expect(JSON.stringify(error.params)).toContain(field);
  });

  it('needs a session', async () => {
    expect((await call(null, 'POST', BASE, { body: { id: uuidv7(), ...HUNTER } })).status).toBe(
      401,
    );
  });
});

describe('GET /arrow-sets and /arrow-sets/:id', () => {
  it('lists newest edit first, active by default, archived on request, with paging', async () => {
    const user = newUser();
    const first = await addSet(user);
    tick();
    const second = await addSet(user);
    tick();
    const archived = await addSet(user);
    await call(user, 'POST', `${BASE}/${archived}/archive`);

    expect(await ids(await call(user, 'GET', BASE))).toEqual([second, first]);
    expect(await ids(await call(user, 'GET', `${BASE}?status=archived`))).toEqual([archived]);

    const one = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(
      await call(user, 'GET', `${BASE}?limit=1`),
    );
    expect(one.items.map((s) => s.id)).toEqual([second]);
    const two = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(
      await call(user, 'GET', `${BASE}?limit=1&cursor=${one.nextCursor}`),
    );
    expect(two.items.map((s) => s.id)).toEqual([first]);
    expect(two.nextCursor).toBeNull();
  });

  it('says how many setups and marks use the set, and 404s one that is not there', async () => {
    const user = newUser();
    const id = await addSet(user);
    usageBySet.set(id, { setups: 3, marks: 21 });
    expect(await bodyOf(await call(user, 'GET', `${BASE}/${id}`))).toMatchObject({
      usage: { setups: 3, marks: 21 },
    });
    expect((await call(user, 'GET', `${BASE}/${uuidv7()}`)).status).toBe(404);
  });
});

describe('PATCH /arrow-sets/:id', () => {
  it('changes only what was sent, bumps the version and the ETag', async () => {
    const user = newUser();
    const id = await addSet(user, { gpi: 8.5 });
    const response = await patch(user, id, { pointWeightG: 5.6 });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await bodyOf(response)).toMatchObject({
      ...HUNTER,
      gpi: 8.5,
      pointWeightG: 5.6,
      version: 2,
    });
  });

  it('clears a field with null, but a set cannot lose its name', async () => {
    const user = newUser();
    const id = await addSet(user, { gpi: 8.5 });
    expect(await bodyOf(await patch(user, id, { gpi: null }))).not.toHaveProperty('gpi');
    expect((await patch(user, id, { name: null }, 2)).status).toBe(400);
  });

  it('refuses a stale version with 412 and a missing one with 428', async () => {
    const user = newUser();
    const id = await addSet(user);
    await patch(user, id, { notes: 'first' });
    const stale = await patch(user, id, { notes: 'second' }, 1);
    expect(stale.status).toBe(412);
    expect((await errorOf(stale)).params).toMatchObject({ currentVersion: 2 });
    expect((await patch(user, id, { notes: 'x' }, null)).status).toBe(428);
    expect(await bodyOf(await call(user, 'GET', `${BASE}/${id}`))).toMatchObject({
      notes: 'first',
    });
  });

  it('is a 404 for a set that does not exist', async () => {
    expect((await patch(newUser(), uuidv7(), { notes: 'x' })).status).toBe(404);
  });
});

describe('archive, unarchive and delete (ADR-008)', () => {
  it('moves the set out of the active list and back, idempotently', async () => {
    const user = newUser();
    const id = await addSet(user);
    const archived = await call(user, 'POST', `${BASE}/${id}/archive`);
    expect(await bodyOf(archived)).toMatchObject({ status: 'archived', version: 2 });
    expect(await ids(await call(user, 'GET', BASE))).toEqual([]);
    expect(await bodyOf(await call(user, 'GET', `${BASE}/${id}`))).toMatchObject({
      status: 'archived',
    });
    const back = await call(user, 'POST', `${BASE}/${id}/unarchive`);
    expect(await bodyOf(back)).toMatchObject({ status: 'active', version: 3 });
  });

  it('deletes a set no setup uses, softly', async () => {
    const user = newUser();
    const id = await addSet(user);
    const response = await call(user, 'DELETE', `${BASE}/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(204);
    expect((await call(user, 'GET', `${BASE}/${id}`)).status).toBe(404);
    const stored = await connection.db?.collection('arrowSets').findOne({ _id: id as never });
    expect(stored?.['deletedAt']).toBeInstanceOf(Date);
  });

  it('refuses a set that setups use, with how many (SM-ARW-409-001)', async () => {
    const user = newUser();
    const id = await addSet(user);
    usageBySet.set(id, { setups: 2, marks: 14 });
    const response = await call(user, 'DELETE', `${BASE}/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatchObject({
      code: 'SM-ARW-409-001',
      params: { setups: 2, marks: 14 },
    });
    expect((await call(user, 'POST', `${BASE}/${id}/archive`)).status).toBe(200);
  });

  it('refuses a stale (412) or missing (428) version on delete', async () => {
    const user = newUser();
    const id = await addSet(user);
    await patch(user, id, { notes: 'x' });
    const stale = await call(user, 'DELETE', `${BASE}/${id}`, { headers: { 'if-match': '"1"' } });
    expect(stale.status).toBe(412);
    expect((await call(user, 'DELETE', `${BASE}/${id}`)).status).toBe(428);
  });
});

describe('isolation of the arrow-set routes (spec 13)', () => {
  it('keeps one archer out of reach of another, route by route', async () => {
    expect(
      await checkIsolation(container.app, container.registry.routes, productionAttacks),
    ).toEqual([]);
  });
});
