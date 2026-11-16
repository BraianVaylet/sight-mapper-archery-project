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
import { createPurgeDeletedAccounts } from '../src/modules/account/index.js';
import { fakeSession, testEnv } from './helpers/app.js';
import { startReplSet } from './helpers/mongo.js';

// HU-ACC-05 (download my data), HU-ACC-06 (ask for deletion, cancel it, and the purge 90 days later).

const START = Temporal.Instant.from('2026-11-02T12:00:00Z');
let now = START;
const clock: Clock = { now: () => now };
const advanceDays = (days: number) => void (now = now.add({ hours: days * 24 }));

let replSet: MongoMemoryReplSet;
let connection: Connection;
let container: ReturnType<typeof createContainer>;
const logger = createLogger({ level: 'silent' });

beforeAll(async () => {
  replSet = await startReplSet();
  connection = await connectMongo(replSet.getUri('sightmapper_account_data'), logger);
  container = createContainer({
    env: testEnv,
    logger,
    connection,
    session: fakeSession,
    clock,
    idempotencyStore: createMongoIdempotencyStore(connection, clock),
  });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

let counter = 0;
const newUser = () => `data-user-${(counter += 1)}`;

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

type Json = Record<string, unknown>;
const bodyOf = async <T = Json>(response: Response) => (await response.json()) as T;
const errorOf = async (response: Response) => (await bodyOf<ErrorEnvelope>(response)).error;
type Me = { version: number; deletionRequestedAt: string | null; purgeAt?: string | null };
const me = async (user: string) => bodyOf<Me>(await call(user, 'GET', '/api/v1/me'));

const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };
async function add(user: string, path: string, body: Json) {
  const id = uuidv7();
  expect((await call(user, 'POST', path, { body: { id, ...body } })).status).toBe(201);
  return id;
}

/** An archer with one of everything: a setup, a mark, and some of it archived, trashed or deleted. */
async function seed(user: string, label: string) {
  const bowId = await add(user, '/api/v1/bows', { bowType: 'compound', model: `${label} bow` });
  const sightId = await add(user, '/api/v1/sights', { model: `${label} sight`, scale: SCALE });
  const arrowSetId = await add(user, '/api/v1/arrow-sets', { name: `${label} arrows` });
  const setupId = await add(user, '/api/v1/setups', {
    bowId,
    sightId,
    arrowSetIds: [arrowSetId],
    name: `${label} setup`,
  });
  const markId = await add(user, '/api/v1/marks', {
    setupId,
    arrowSetId,
    distanceM: 30,
    scaleValueMm: 8,
    replace: false,
  });
  return { bowId, sightId, arrowSetId, setupId, markId };
}

const countOf = (collection: string, userId: string) =>
  connection.db?.collection(collection).countDocuments({ userId }) ?? Promise.resolve(0);

describe('GET /me/export (HU-ACC-05)', () => {
  it('hands over everything stored: profile, equipment, setups and marks, in canonical units', async () => {
    const user = newUser();
    const s = await seed(user, 'Mine');
    const response = await call(user, 'GET', '/api/v1/me/export');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="sight-mapper-2026-11-02\.json"$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const data = await bodyOf<{
      schemaVersion: number;
      exportedAt: string;
      profile: Json;
      bows: Json[];
      sights: Json[];
      arrowSets: Json[];
      setups: Json[];
      marks: Json[];
    }>(response);

    expect(data.schemaVersion).toBe(1);
    expect(data.exportedAt).toBe('2026-11-02T12:00:00Z');
    expect(data.profile).toMatchObject({ locale: 'es', unitSystem: 'metric', quickAccess: null });
    expect(data.bows.map((r) => r['id'])).toEqual([s.bowId]);
    expect(data.sights.map((r) => r['id'])).toEqual([s.sightId]);
    expect(data.arrowSets.map((r) => r['id'])).toEqual([s.arrowSetId]);
    expect(data.setups.map((r) => r['id'])).toEqual([s.setupId]);
    // Canonical: metres and millimetres, as stored.
    expect(data.marks[0]).toMatchObject({ id: s.markId, distanceM: 30, scaleValueMm: 8 });
  });

  it('includes what is archived, in the trash, or deleted by itself: all that is stored', async () => {
    const user = newUser();
    const s = await seed(user, 'Old');
    const extra = await add(user, '/api/v1/bows', { bowType: 'compound', model: 'Archived' });
    expect((await call(user, 'POST', `/api/v1/bows/${extra}/archive`)).status).toBe(200);
    const lone = await add(user, '/api/v1/marks', {
      setupId: s.setupId,
      arrowSetId: s.arrowSetId,
      distanceM: 40,
      scaleValueMm: 16,
      replace: false,
    });
    expect(
      (await call(user, 'DELETE', `/api/v1/marks/${lone}`, { headers: { 'if-match': '"1"' } }))
        .status,
    ).toBe(204);
    expect(
      (
        await call(user, 'DELETE', `/api/v1/setups/${s.setupId}`, {
          headers: { 'if-match': '"1"' },
        })
      ).status,
    ).toBe(204);

    const data = await bodyOf<{ bows: Json[]; setups: Json[]; marks: Json[] }>(
      await call(user, 'GET', '/api/v1/me/export'),
    );
    expect(data.bows).toHaveLength(2);
    expect(data.bows.find((b) => b['id'] === extra)).toMatchObject({ status: 'archived' });
    expect(data.setups[0]).toMatchObject({ id: s.setupId, deletedAt: expect.any(String) });
    expect(data.marks.map((m) => m['id']).sort()).toEqual([s.markId, lone].sort());
    expect(data.marks.every((m) => typeof m['deletedAt'] === 'string')).toBe(true);
  });

  it("never carries the user id, the driver bookkeeping, or another archer's data", async () => {
    const a = newUser();
    const b = newUser();
    await seed(a, 'Alpha');
    await seed(b, 'Bravo');
    const text = await (await call(a, 'GET', '/api/v1/me/export')).text();
    expect(text).not.toContain(a);
    expect(text).not.toContain('"userId"');
    expect(text).not.toContain('"_id"');
    expect(text).not.toContain('"__v"');
    expect(text).not.toContain('Bravo');
  });

  it('is an empty, valid document for an archer with nothing', async () => {
    const data = await bodyOf<Json>(await call(newUser(), 'GET', '/api/v1/me/export'));
    for (const key of ['bows', 'sights', 'arrowSets', 'setups', 'marks'])
      expect(data[key]).toEqual([]);
  });

  it('needs a session', async () => {
    expect((await call(null, 'GET', '/api/v1/me/export')).status).toBe(401);
  });
});

describe('asking for deletion (HU-ACC-06)', () => {
  it('records the request and says when it will be carried out: 90 days later', async () => {
    const user = newUser();
    const before = await me(user);
    const response = await call(user, 'POST', '/api/v1/me/deletion-request');
    expect(response.status).toBe(200);
    const after = await bodyOf<Me>(response);
    expect(after.deletionRequestedAt).toBe('2026-11-02T12:00:00Z');
    expect(after.purgeAt).toBe('2027-01-31T12:00:00Z');
    expect(after.version).toBe(before.version + 1);
    expect(response.headers.get('etag')).toBe(`"${after.version}"`);
    expect((await me(user)).purgeAt).toBe('2027-01-31T12:00:00Z');
  });

  it('removes nothing now: the app keeps working and the data is all there', async () => {
    const user = newUser();
    await seed(user, 'Keep');
    await call(user, 'POST', '/api/v1/me/deletion-request');
    expect(await countOf('bows', user)).toBe(1);
    expect((await call(user, 'GET', '/api/v1/bows')).status).toBe(200);
    expect((await call(user, 'GET', '/api/v1/me/export')).status).toBe(200);
  });

  it('refuses a second request and says when the first will happen: SM-ACC-409-001', async () => {
    const user = newUser();
    await call(user, 'POST', '/api/v1/me/deletion-request');
    advanceDays(3);
    const again = await call(user, 'POST', '/api/v1/me/deletion-request');
    expect(again.status).toBe(409);
    const error = await errorOf(again);
    expect(error.code).toBe('SM-ACC-409-001');
    // The date of the first request, not of this one.
    expect(error.params['purgeAt']).toBe('2027-01-31T12:00:00Z');
    advanceDays(-3);
  });

  it('needs a session', async () => {
    expect((await call(null, 'POST', '/api/v1/me/deletion-request')).status).toBe(401);
  });
});

describe('cancelling the deletion', () => {
  it('withdraws the request, so it can be asked for again', async () => {
    const user = newUser();
    const requested = await bodyOf<Me>(await call(user, 'POST', '/api/v1/me/deletion-request'));
    const cancelled = await call(user, 'DELETE', '/api/v1/me/deletion-request');
    expect(cancelled.status).toBe(200);
    const body = await bodyOf<Me>(cancelled);
    expect(body.deletionRequestedAt).toBeNull();
    expect(body.purgeAt).toBeNull();
    expect(body.version).toBe(requested.version + 1);
    expect((await call(user, 'POST', '/api/v1/me/deletion-request')).status).toBe(200);
  });

  it('is SM-ACC-404-001 when there is nothing to cancel', async () => {
    const user = newUser();
    const response = await call(user, 'DELETE', '/api/v1/me/deletion-request');
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe('SM-ACC-404-001');
  });

  it('takes no If-Match: the way out works whatever else changed in the profile since', async () => {
    const user = newUser();
    await call(user, 'POST', '/api/v1/me/deletion-request');
    // The archer changes the theme (in another tab): the profile moves on to a newer version.
    const version = (await me(user)).version;
    expect(
      (
        await call(user, 'PATCH', '/api/v1/me/preferences', {
          body: { theme: 'dark' },
          headers: { 'if-match': `"${version}"` },
        })
      ).status,
    ).toBe(200);
    const cancelled = await call(user, 'DELETE', '/api/v1/me/deletion-request');
    expect(cancelled.status).toBe(200);
    expect((await bodyOf<Me>(cancelled)).deletionRequestedAt).toBeNull();
  });

  it('is not a second chance for a request that was already withdrawn: 404 again', async () => {
    const user = newUser();
    await call(user, 'POST', '/api/v1/me/deletion-request');
    expect((await call(user, 'DELETE', '/api/v1/me/deletion-request')).status).toBe(200);
    expect((await call(user, 'DELETE', '/api/v1/me/deletion-request')).status).toBe(404);
  });
});

describe('the purge, 90 days later (purgeDeletedAccounts)', () => {
  const job = () => createPurgeDeletedAccounts({ bus: container.bus });
  const run = () => job().run({ now, connection, logger });

  it('removes the account and everything in it once the 90 days are up, and only then', async () => {
    const gone = newUser();
    const stays = newUser();
    await seed(gone, 'Gone');
    await seed(stays, 'Stays');
    await me(stays); // has a profile too
    await call(gone, 'POST', '/api/v1/me/deletion-request');

    advanceDays(89);
    expect(await run()).toEqual({ purged: 0 });
    expect(await countOf('bows', gone)).toBe(1);

    advanceDays(1); // exactly 90 days
    const stats = await run();
    expect(stats['purged']).toBeGreaterThanOrEqual(1);
    for (const collection of ['bows', 'sights', 'arrowSets', 'setups', 'marks', 'profiles']) {
      expect(await countOf(collection, gone), collection).toBe(0);
    }
    // Another archer, who asked for nothing, keeps all of it.
    for (const collection of ['bows', 'sights', 'arrowSets', 'setups', 'marks', 'profiles']) {
      expect(await countOf(collection, stays), collection).toBe(1);
    }
    advanceDays(-90);
  });

  it('also removes what was in the trash, archived or deleted by itself', async () => {
    const user = newUser();
    const s = await seed(user, 'Trashed');
    await call(user, 'DELETE', `/api/v1/setups/${s.setupId}`, { headers: { 'if-match': '"1"' } });
    await call(user, 'POST', '/api/v1/me/deletion-request');
    advanceDays(91);
    await run();
    for (const collection of ['bows', 'sights', 'arrowSets', 'setups', 'marks', 'profiles']) {
      expect(await countOf(collection, user), collection).toBe(0);
    }
    advanceDays(-91);
  });

  it('leaves alone an archer who changed their mind in time', async () => {
    const user = newUser();
    await seed(user, 'Changed');
    await call(user, 'POST', '/api/v1/me/deletion-request');
    advanceDays(60);
    await call(user, 'DELETE', '/api/v1/me/deletion-request');
    advanceDays(40);
    await run();
    expect(await countOf('bows', user)).toBe(1);
    expect(await countOf('profiles', user)).toBe(1);
    advanceDays(-100);
  });

  it('can run again: a second run has nothing left to do (idempotent)', async () => {
    const user = newUser();
    await seed(user, 'Twice');
    await call(user, 'POST', '/api/v1/me/deletion-request');
    advanceDays(95);
    const first = await run();
    expect(first['purged']).toBeGreaterThanOrEqual(1);
    expect(await run()).toEqual({ purged: 0 });
    advanceDays(-95);
  });

  it('keeps the profile when a module fails halfway, so the next run finishes the job', async () => {
    const user = newUser();
    await seed(user, 'Halfway');
    await call(user, 'POST', '/api/v1/me/deletion-request');
    advanceDays(91);
    let fail = true;
    const failing = {
      publish: async (type: 'AccountPurged', payload: { userId: string }) => {
        if (fail) throw new Error('a module is down');
        await container.bus.publish(type, payload);
      },
    };
    await expect(
      createPurgeDeletedAccounts({ bus: failing }).run({ now, connection, logger }),
    ).rejects.toThrow('a module is down');
    expect(await countOf('profiles', user)).toBe(1);

    fail = false;
    await createPurgeDeletedAccounts({ bus: failing }).run({ now, connection, logger });
    expect(await countOf('profiles', user)).toBe(0);
    advanceDays(-91);
  });

  it('is registered with the scheduler, daily', () => {
    expect(job().name).toBe('purgeDeletedAccounts');
    expect(job().intervalMs).toBe(24 * 60 * 60 * 1000);
  });
});
