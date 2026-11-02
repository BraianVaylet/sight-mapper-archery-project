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

/** What the calculator will answer once it exists: marks on a sight, on demand. */
const marksOn = new Map<string, { count: number; outside: number }>();
const rescaled: { sightId: string; strategy: string | undefined; to: unknown }[] = [];
const usageBySight = new Map<string, { setups: number; marks: number }>();

beforeAll(async () => {
  replSet = await startReplSet();
  const logger = createLogger({ level: 'silent' });
  connection = await connectMongo(replSet.getUri('sightmapper_sights'), logger);
  container = createContainer({
    env: testEnv,
    logger,
    connection,
    clock,
    session: fakeSession,
    idempotencyStore: createMongoIdempotencyStore(connection, clock),
    componentUsage: {
      bowUsage: () => Promise.resolve({ setups: 0, marks: 0 }),
      arrowSetUsage: () => Promise.resolve({ setups: 0, marks: 0 }),
      sightUsage: (_userId, sightId) =>
        Promise.resolve(usageBySight.get(sightId) ?? { setups: 0, marks: 0 }),
    },
    sightMarks: {
      count: (_userId, sightId) => Promise.resolve(marksOn.get(sightId)?.count ?? 0),
      countOutside: (_userId, sightId) => Promise.resolve(marksOn.get(sightId)?.outside ?? 0),
      rescale: (_userId, sightId, change) => {
        rescaled.push({ sightId, strategy: change.strategy, to: change.to });
        return Promise.resolve();
      },
    },
  });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

let counter = 0;
const newUser = () => `sight-user-${(counter += 1)}`;

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

const CM_SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };
const ULTRAVIEW = { manufacturer: 'Sight Master', model: 'Ultraview', scale: CM_SCALE };

async function addSight(user: string, fields: Record<string, unknown> = {}) {
  const id = uuidv7();
  const response = await call(user, 'POST', '/api/v1/sights', {
    body: { id, ...ULTRAVIEW, ...fields },
  });
  expect(response.status).toBe(201);
  return id;
}

const bodyOf = async <T = Record<string, unknown>>(response: Response) =>
  (await response.json()) as T;
const errorOf = async (response: Response) => (await bodyOf<ErrorEnvelope>(response)).error;
const patch = (user: string, id: string, body: unknown, version: number | null = 1) =>
  call(user, 'PATCH', `/api/v1/sights/${id}`, {
    body,
    headers: version === null ? {} : { 'if-match': `"${version}"` },
  });
const ids = async (response: Response) =>
  (await bodyOf<{ items: { id: string }[] }>(response)).items.map((sight) => sight.id);

describe('POST /sights (HU-SGT-01)', () => {
  it('adds a sight with its scale, a default pin and the ETag', async () => {
    const user = newUser();
    const id = uuidv7();
    const response = await call(user, 'POST', '/api/v1/sights', { body: { id, ...ULTRAVIEW } });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    const created = await bodyOf(response);
    expect(created).toMatchObject({
      id,
      pinType: 'monopin',
      scale: CM_SCALE,
      status: 'active',
      version: 1,
    });
    expect(created).not.toHaveProperty('userId');
    expect(await ids(await call(user, 'GET', '/api/v1/sights'))).toEqual([id]);
    expect(await bodyOf(await call(user, 'GET', `/api/v1/sights/${id}`))).toMatchObject({
      usage: { setups: 0, marks: 0 },
    });
  });

  it('takes a custom unit with its physical size, and a click scale with none', async () => {
    const user = newUser();
    const custom = await call(user, 'POST', '/api/v1/sights', {
      body: {
        id: uuidv7(),
        model: 'Custom',
        scale: { unit: 'custom', unitSizeMm: 10, min: 1, max: 9, resolution: 0.5 },
      },
    });
    expect(await bodyOf(custom)).toMatchObject({ scale: { unit: 'custom', unitSizeMm: 10 } });

    const click = await call(user, 'POST', '/api/v1/sights', {
      body: {
        id: uuidv7(),
        model: 'Clicks',
        scale: { unit: 'click', min: 0, max: 100, resolution: 1 },
      },
    });
    expect(click.status).toBe(201);
    expect(await bodyOf(click)).not.toHaveProperty('scale.unitSizeMm');
  });

  it('keeps the direction the archer chose: growing upward', async () => {
    const response = await call(newUser(), 'POST', '/api/v1/sights', {
      body: { id: uuidv7(), model: 'Up', scale: { ...CM_SCALE, direction: 'up' } },
    });
    expect(await bodyOf(response)).toMatchObject({ scale: { direction: 'up' } });
  });

  it('is idempotent: the same key three times makes one sight and the same answer', async () => {
    const user = newUser();
    const key = uuidv7();
    const body = { id: uuidv7(), ...ULTRAVIEW };
    const answers = [];
    for (let i = 0; i < 3; i++) {
      const response = await call(user, 'POST', '/api/v1/sights', {
        body,
        headers: { 'idempotency-key': key },
      });
      expect(response.status).toBe(201);
      answers.push(await response.text());
    }
    expect(new Set(answers).size).toBe(1);
    expect(await connection.db?.collection('sights').countDocuments({ userId: user })).toBe(1);
  });

  it('refuses an id that exists with 409', async () => {
    const user = newUser();
    const id = await addSight(user);
    const again = await call(user, 'POST', '/api/v1/sights', { body: { id, ...ULTRAVIEW } });
    expect(again.status).toBe(409);
    expect((await errorOf(again)).code).toBe('SM-CORE-409-002');
  });

  it.each([
    [
      'a minimum not below the maximum',
      { scale: { ...CM_SCALE, min: 10, max: 10 } },
      'validation.scale.minLessThanMax',
    ],
    [
      'a resolution larger than the travel',
      { scale: { ...CM_SCALE, resolution: 11 } },
      'validation.scale.resolutionTooLarge',
    ],
    [
      'a unit size on a fixed unit',
      { scale: { ...CM_SCALE, unitSizeMm: 7 } },
      'validation.sight.fixedUnitSize',
    ],
    [
      'no manufacturer and no model',
      { manufacturer: undefined, model: undefined },
      'validation.equipment.manufacturerOrModel',
    ],
    ['an unknown pin type', { pinType: 'hexapin' }, 'pinType'],
  ])('rejects %s, naming what is wrong', async (_name, fields, key) => {
    const response = await call(newUser(), 'POST', '/api/v1/sights', {
      body: { id: uuidv7(), ...ULTRAVIEW, ...fields },
    });
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe('SM-CORE-400-001');
    expect(JSON.stringify(error.params)).toContain(key);
  });

  it('needs a session', async () => {
    const response = await call(null, 'POST', '/api/v1/sights', {
      body: { id: uuidv7(), ...ULTRAVIEW },
    });
    expect(response.status).toBe(401);
  });
});

describe('GET /sights and GET /sights/:id', () => {
  it('lists newest edit first, active by default, archived on request, with paging', async () => {
    const user = newUser();
    const first = await addSight(user);
    tick();
    const second = await addSight(user);
    tick();
    const archived = await addSight(user);
    await call(user, 'POST', `/api/v1/sights/${archived}/archive`);

    expect(await ids(await call(user, 'GET', '/api/v1/sights'))).toEqual([second, first]);
    expect(await ids(await call(user, 'GET', '/api/v1/sights?status=archived'))).toEqual([
      archived,
    ]);

    const one = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(
      await call(user, 'GET', '/api/v1/sights?limit=1'),
    );
    expect(one.items.map((s) => s.id)).toEqual([second]);
    const two = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(
      await call(user, 'GET', `/api/v1/sights?limit=1&cursor=${one.nextCursor}`),
    );
    expect(two.items.map((s) => s.id)).toEqual([first]);
    expect(two.nextCursor).toBeNull();
  });

  it('says how many setups and marks use the sight, and 404s one that is not there', async () => {
    const user = newUser();
    const id = await addSight(user);
    usageBySight.set(id, { setups: 1, marks: 6 });
    expect(await bodyOf(await call(user, 'GET', `/api/v1/sights/${id}`))).toMatchObject({
      usage: { setups: 1, marks: 6 },
    });
    expect((await call(user, 'GET', `/api/v1/sights/${uuidv7()}`)).status).toBe(404);
  });
});

describe('PATCH /sights/:id', () => {
  it('changes only what was sent, bumps the version and the ETag', async () => {
    const user = newUser();
    const id = await addSight(user);
    const response = await patch(user, id, { nickname: 'Mi mira', pinType: 'dualpin' });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await bodyOf(response)).toMatchObject({
      nickname: 'Mi mira',
      pinType: 'dualpin',
      manufacturer: 'Sight Master',
      scale: CM_SCALE,
      version: 2,
    });
  });

  it('clears a field with null, and refuses a stale version with 412', async () => {
    const user = newUser();
    const id = await addSight(user, { nickname: 'Vieja' });
    expect(await bodyOf(await patch(user, id, { nickname: null }))).not.toHaveProperty('nickname');
    const stale = await patch(user, id, { nickname: 'x' }, 1);
    expect(stale.status).toBe(412);
    expect((await errorOf(stale)).params).toMatchObject({ currentVersion: 2 });
    expect((await patch(user, id, { nickname: 'x' }, null)).status).toBe(428);
  });

  it('changes the scale freely while there are no marks', async () => {
    const user = newUser();
    const id = await addSight(user);
    const response = await patch(user, id, {
      scale: { unit: 'custom', unitSizeMm: 8, min: 0, max: 20, resolution: 1 },
    });
    expect(response.status).toBe(200);
    expect(await bodyOf(response)).toMatchObject({ scale: { unit: 'custom', unitSizeMm: 8 } });
    expect(rescaled.filter((r) => r.sightId === id)).toEqual([]);
  });

  describe('with marks on the sight (HU-SGT-02)', () => {
    const withMarks = async (count: number, outside = 0) => {
      const user = newUser();
      const id = await addSight(user);
      marksOn.set(id, { count, outside });
      return { user, id };
    };

    it('asks what to keep when the unit size changes (SM-SGT-409-003) and writes nothing', async () => {
      const { user, id } = await withMarks(6);
      const response = await patch(user, id, { scale: { ...CM_SCALE, unit: 'mm' } });
      expect(response.status).toBe(409);
      expect(await errorOf(response)).toMatchObject({
        code: 'SM-SGT-409-003',
        params: { marks: 6 },
      });
      expect(await bodyOf(await call(user, 'GET', `/api/v1/sights/${id}`))).toMatchObject({
        version: 1,
        scale: { unit: 'cm' },
      });
    });

    it.each(['keepReadings', 'keepPositions'])(
      'applies the scale and tells the marks to %s',
      async (strategy) => {
        const { user, id } = await withMarks(6);
        const response = await patch(user, id, {
          scale: { ...CM_SCALE, unit: 'mm', max: 100, resolution: 1 },
          scaleChangeStrategy: strategy,
        });
        expect(response.status).toBe(200);
        expect(rescaled.filter((r) => r.sightId === id)).toEqual([
          expect.objectContaining({ strategy, to: expect.objectContaining({ unit: 'mm' }) }),
        ]);
      },
    );

    it('refuses a change that leaves marks off the scale, with how many (SM-SGT-409-002)', async () => {
      const { user, id } = await withMarks(6, 2);
      const response = await patch(user, id, { scale: { ...CM_SCALE, max: 5 } });
      expect(response.status).toBe(409);
      expect(await errorOf(response)).toMatchObject({
        code: 'SM-SGT-409-002',
        params: { count: 2, minMm: 0, maxMm: 50 },
      });
      expect(await bodyOf(await call(user, 'GET', `/api/v1/sights/${id}`))).toMatchObject({
        version: 1,
        scale: { max: 10 },
      });
    });

    it('needs no strategy when only the range, resolution or direction change', async () => {
      const { user, id } = await withMarks(6);
      const response = await patch(user, id, {
        scale: { ...CM_SCALE, max: 12, resolution: 0.5, direction: 'up' },
      });
      expect(response.status).toBe(200);
      expect(rescaled.filter((r) => r.sightId === id)).toEqual([]);
    });

    it('needs no strategy when nothing about the scale changes', async () => {
      const { user, id } = await withMarks(6);
      expect((await patch(user, id, { nickname: 'x' })).status).toBe(200);
    });
  });
});

describe('archive, unarchive and delete (ADR-008)', () => {
  it('moves the sight out of the active list and back', async () => {
    const user = newUser();
    const id = await addSight(user);
    const archived = await call(user, 'POST', `/api/v1/sights/${id}/archive`);
    expect(await bodyOf(archived)).toMatchObject({ status: 'archived', version: 2 });
    expect(await ids(await call(user, 'GET', '/api/v1/sights'))).toEqual([]);
    const back = await call(user, 'POST', `/api/v1/sights/${id}/unarchive`);
    expect(await bodyOf(back)).toMatchObject({ status: 'active', version: 3 });
  });

  it('deletes a sight no setup uses, softly', async () => {
    const user = newUser();
    const id = await addSight(user);
    const response = await call(user, 'DELETE', `/api/v1/sights/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(204);
    expect((await call(user, 'GET', `/api/v1/sights/${id}`)).status).toBe(404);
    const stored = await connection.db?.collection('sights').findOne({ _id: id as never });
    expect(stored?.['deletedAt']).toBeInstanceOf(Date);
  });

  it('refuses a sight that setups use, with how many (SM-SGT-409-001)', async () => {
    const user = newUser();
    const id = await addSight(user);
    usageBySight.set(id, { setups: 2, marks: 14 });
    const response = await call(user, 'DELETE', `/api/v1/sights/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatchObject({
      code: 'SM-SGT-409-001',
      params: { setups: 2, marks: 14 },
    });
    expect((await call(user, 'POST', `/api/v1/sights/${id}/archive`)).status).toBe(200);
  });

  it('refuses a stale (412) or missing (428) version on delete', async () => {
    const user = newUser();
    const id = await addSight(user);
    await patch(user, id, { nickname: 'x' });
    const stale = await call(user, 'DELETE', `/api/v1/sights/${id}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(stale.status).toBe(412);
    expect((await call(user, 'DELETE', `/api/v1/sights/${id}`)).status).toBe(428);
  });
});

describe('isolation of the sight routes (spec 13)', () => {
  it('keeps one archer out of reach of another, route by route', async () => {
    expect(
      await checkIsolation(container.app, container.registry.routes, productionAttacks),
    ).toEqual([]);
  });
});
