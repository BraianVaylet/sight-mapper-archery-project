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
import { purgeDeletedSetups } from '../src/modules/calculator/index.js';
import { productionAttacks } from './attacks/index.js';
import { fakeSession, testEnv } from './helpers/app.js';
import { checkIsolation } from './helpers/isolation.js';
import { startReplSet } from './helpers/mongo.js';

let replSet: MongoMemoryReplSet;
let connection: Connection;
let container: ReturnType<typeof createContainer>;

const START = Temporal.Instant.from('2026-11-03T12:00:00Z');
let now = START;
const clock: Clock = { now: () => now };

beforeAll(async () => {
  replSet = await startReplSet();
  const logger = createLogger({ level: 'silent' });
  connection = await connectMongo(replSet.getUri('sightmapper_marks'), logger);
  // Nothing is faked here: the marks, the usage counts and the transactions are the real ones.
  container = createContainer({
    env: testEnv,
    logger,
    connection,
    clock,
    session: fakeSession,
    idempotencyStore: createMongoIdempotencyStore(connection, clock),
  });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

let counter = 0;
const newUser = () => `mark-user-${(counter += 1)}`;

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

const bodyOf = async <T = Record<string, unknown>>(response: Response) =>
  (await response.json()) as T;
const errorOf = async (response: Response) => (await bodyOf<ErrorEnvelope>(response)).error;

/** cm, 0 to 10: the author's sight. One unit is 10 mm, so the scale covers 0 to 100 mm. */
const CM = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };

async function add(user: string, path: string, body: Record<string, unknown>) {
  const id = uuidv7();
  const response = await call(user, 'POST', path, { body: { id, ...body } });
  expect(response.status).toBe(201);
  return id;
}

/** An archer with a bow, a sight (0 to 100 mm), two arrow sets and a setup that joins them. */
async function archer(scale: Record<string, unknown> = CM) {
  const user = newUser();
  const bowId = await add(user, '/api/v1/bows', { bowType: 'compound', model: 'Alpha' });
  const sightId = await add(user, '/api/v1/sights', { model: 'Ultraview', scale });
  const arrowId = await add(user, '/api/v1/arrow-sets', { name: 'Hunter 400' });
  const otherArrowId = await add(user, '/api/v1/arrow-sets', { name: 'Pierce 400' });
  const setupId = await add(user, '/api/v1/setups', {
    bowId,
    sightId,
    arrowSetIds: [arrowId, otherArrowId],
  });
  return { user, bowId, sightId, arrowId, otherArrowId, setupId };
}
type Archer = Awaited<ReturnType<typeof archer>>;

const markBody = (a: Archer, over: Record<string, unknown> = {}) => ({
  id: uuidv7(),
  setupId: a.setupId,
  arrowSetId: a.arrowId,
  distanceM: 40,
  scaleValueMm: 16,
  ...over,
});
const record = async (a: Archer, over: Record<string, unknown> = {}) => {
  const body = markBody(a, over);
  const response = await call(a.user, 'POST', '/api/v1/marks', { body });
  expect(response.status).toBe(201);
  return body.id;
};
const post = (a: Archer, over: Record<string, unknown> = {}) =>
  call(a.user, 'POST', '/api/v1/marks', { body: markBody(a, over) });
const list = async (a: Archer, arrowSetId = a.arrowId) =>
  (
    await bodyOf<{
      items: { id: string; distanceM: number; scaleValueMm: number; note?: string }[];
    }>(await call(a.user, 'GET', `/api/v1/setups/${a.setupId}/marks?arrowSetId=${arrowSetId}`))
  ).items;
const patch = (a: Archer, id: string, body: unknown, version: number | null = 1) =>
  call(a.user, 'PATCH', `/api/v1/marks/${id}`, {
    body,
    headers: version === null ? {} : { 'if-match': `"${version}"` },
  });
const remove = (a: Archer, id: string, version = 1) =>
  call(a.user, 'DELETE', `/api/v1/marks/${id}`, { headers: { 'if-match': `"${version}"` } });
const trashSetup = (a: Archer) =>
  call(a.user, 'DELETE', `/api/v1/setups/${a.setupId}`, { headers: { 'if-match': '"1"' } });

describe('POST /marks (HU-MRK-01)', () => {
  it('records a mark with its ETag, the measured origin and the date it was taken', async () => {
    const a = await archer();
    const body = markBody(a, { note: 'viento cruzado' });
    const response = await call(a.user, 'POST', '/api/v1/marks', { body });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    const created = await bodyOf(response);
    expect(created).toMatchObject({
      id: body.id,
      setupId: a.setupId,
      arrowSetId: a.arrowId,
      distanceM: 40,
      scaleValueMm: 16,
      origin: 'measured',
      note: 'viento cruzado',
      version: 1,
      deletedAt: null,
      measuredAt: START.toString(),
    });
    expect(created).not.toHaveProperty('userId');
    expect(await list(a)).toHaveLength(1);
  });

  it('counts on the setup: the Home shows how many marks it holds', async () => {
    const a = await archer();
    await record(a, { distanceM: 20 });
    await record(a, { distanceM: 30, scaleValueMm: 8 });
    const view = await bodyOf(await call(a.user, 'GET', `/api/v1/setups/${a.setupId}`));
    expect(view).toMatchObject({ marksCount: 2 });
  });

  it('is idempotent: the same key three times records one mark and answers the same', async () => {
    const a = await archer();
    const key = uuidv7();
    const body = markBody(a);
    const answers = [];
    for (let i = 0; i < 3; i++) {
      const response = await call(a.user, 'POST', '/api/v1/marks', {
        body,
        headers: { 'idempotency-key': key },
      });
      expect(response.status).toBe(201);
      answers.push(await response.text());
    }
    expect(new Set(answers).size).toBe(1);
    expect(await list(a)).toHaveLength(1);
  });

  it('accepts the two ends of the scale and refuses anything past them (SM-MARK-422-001)', async () => {
    const a = await archer();
    expect((await post(a, { distanceM: 10, scaleValueMm: 0 })).status).toBe(201);
    expect((await post(a, { distanceM: 20, scaleValueMm: 100 })).status).toBe(201);
    for (const [distanceM, scaleValueMm] of [
      [30, 100.001],
      [31, -0.001],
      [32, 95 * 10],
    ] as const) {
      const response = await post(a, { distanceM, scaleValueMm });
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toMatchObject({
        code: 'SM-MARK-422-001',
        params: { minMm: 0, maxMm: 100 },
      });
    }
    expect(await list(a)).toHaveLength(2);
  });

  it('checks the scale of the sight as it is now: a click sight without a size reads as 1 mm per click', async () => {
    const a = await archer({ unit: 'click', min: 0, max: 60, resolution: 1, direction: 'down' });
    expect((await post(a, { scaleValueMm: 60 })).status).toBe(201);
    expect((await post(a, { distanceM: 50, scaleValueMm: 61 })).status).toBe(422);
  });

  it("refuses an arrow set that is not the setup's (SM-MARK-422-002), even one the archer owns", async () => {
    const a = await archer();
    const stray = await add(a.user, '/api/v1/arrow-sets', { name: 'Not in the setup' });
    const response = await post(a, { arrowSetId: stray });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: 'SM-MARK-422-002',
      params: { arrowSetId: stray },
    });
  });

  it("is a 404 for a setup that is missing, someone else's, or in the trash", async () => {
    const a = await archer();
    expect((await post(a, { setupId: uuidv7() })).status).toBe(404);
    const other = await archer();
    expect((await post(a, { setupId: other.setupId })).status).toBe(404);
    await trashSetup(a);
    expect((await post(a)).status).toBe(404);
  });

  it.each([
    ['a distance of 0', { distanceM: 0 }, 'distanceM'],
    ['a distance of 350 m', { distanceM: 350 }, 'distanceM'],
    [
      'a distance finer than a millimetre',
      { distanceM: 40.0004 },
      'validation.mark.distancePrecision',
    ],
    ['a note over 200 characters', { note: 'x'.repeat(201) }, 'note'],
    ['no reading', { scaleValueMm: undefined }, 'scaleValueMm'],
  ])('rejects %s with SM-CORE-400-001', async (_name, over, key) => {
    const a = await archer();
    const response = await post(a, over);
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe('SM-CORE-400-001');
    expect(JSON.stringify(error.params)).toContain(key);
  });

  it('refuses a date in the future, with five minutes of tolerance for a fast device clock', async () => {
    const a = await archer();
    expect((await post(a, { measuredAt: START.add({ minutes: 4 }).toString() })).status).toBe(201);
    const late = await post(a, { distanceM: 50, measuredAt: START.add({ minutes: 6 }).toString() });
    expect(late.status).toBe(400);
    expect(JSON.stringify((await errorOf(late)).params)).toContain('measuredAtFuture');
    // A date in the past is what it says.
    const past = await post(a, { distanceM: 60, measuredAt: '2026-10-31T09:00:00Z' });
    expect(await bodyOf(past)).toMatchObject({ measuredAt: '2026-10-31T09:00:00Z' });
  });

  it('needs a session', async () => {
    const a = await archer();
    const response = await call(null, 'POST', '/api/v1/marks', { body: markBody(a) });
    expect(response.status).toBe(401);
  });
});

describe('a second mark at the same distance (HU-MRK-02, RN-MRK-04)', () => {
  it('is refused, naming the existing one so the screen can ask to replace it', async () => {
    const a = await archer();
    const first = await record(a);
    const again = await post(a, { scaleValueMm: 17 });
    expect(again.status).toBe(409);
    expect(await errorOf(again)).toMatchObject({
      code: 'SM-MARK-409-001',
      params: { existingMarkId: first, distanceM: 40 },
    });
    expect(await list(a)).toHaveLength(1);
  });

  it('with replace: true the existing mark takes the new reading and exactly one stays', async () => {
    const a = await archer();
    const first = await record(a, { note: 'viejo' });
    const replaced = await post(a, { scaleValueMm: 18, replace: true });
    expect(replaced.status).toBe(200);
    expect(await bodyOf(replaced)).toMatchObject({ id: first, scaleValueMm: 18, version: 2 });
    const [only, ...rest] = await list(a);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ id: first, scaleValueMm: 18 });
    expect(only).not.toHaveProperty('note');
  });

  it('does not mix arrow sets or setups: 40 m of another set is a different mark', async () => {
    const a = await archer();
    await record(a);
    expect((await post(a, { arrowSetId: a.otherArrowId })).status).toBe(201);
    expect(await list(a, a.otherArrowId)).toHaveLength(1);
  });
});

describe('GET /setups/:id/marks', () => {
  it('lists the pair nearest first, and only that pair', async () => {
    const a = await archer();
    await record(a, { distanceM: 60, scaleValueMm: 36 });
    await record(a, { distanceM: 20, scaleValueMm: 3 });
    await record(a, { distanceM: 40, scaleValueMm: 16 });
    await record(a, { arrowSetId: a.otherArrowId, distanceM: 10 });
    expect((await list(a)).map((m) => m.distanceM)).toEqual([20, 40, 60]);
  });

  it('is empty for a pair with no marks, and 422 for an arrow set the setup does not have', async () => {
    const a = await archer();
    expect(await list(a)).toEqual([]);
    const response = await call(
      a.user,
      'GET',
      `/api/v1/setups/${a.setupId}/marks?arrowSetId=${uuidv7()}`,
    );
    expect(response.status).toBe(422);
    expect((await call(a.user, 'GET', `/api/v1/setups/${a.setupId}/marks`)).status).toBe(400);
  });
});

describe('PATCH /marks/:id (HU-MRK-03)', () => {
  it('edits the reading, the note and the date, bumps the version and sends the new ETag', async () => {
    const a = await archer();
    const id = await record(a);
    const response = await patch(a, id, {
      scaleValueMm: 17,
      note: 'sin viento',
      measuredAt: '2026-11-01T10:00:00Z',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await bodyOf(response)).toMatchObject({
      scaleValueMm: 17,
      note: 'sin viento',
      measuredAt: '2026-11-01T10:00:00Z',
      version: 2,
      distanceM: 40,
    });
  });

  it('clears the note with null and leaves what was not sent', async () => {
    const a = await archer();
    const id = await record(a, { note: 'x' });
    const body = await bodyOf(await patch(a, id, { note: null }));
    expect(body).not.toHaveProperty('note');
    expect(body).toMatchObject({ distanceM: 40, scaleValueMm: 16 });
  });

  it('keeps the setup and the arrow set of the mark: another pair is another mark', async () => {
    const a = await archer();
    const id = await record(a);
    const body = await bodyOf(
      await patch(a, id, { setupId: uuidv7(), arrowSetId: a.otherArrowId, scaleValueMm: 17 }),
    );
    expect(body).toMatchObject({ setupId: a.setupId, arrowSetId: a.arrowId });
  });

  it('refuses a reading off the scale (SM-MARK-422-001)', async () => {
    const a = await archer();
    const id = await record(a);
    const response = await patch(a, id, { scaleValueMm: 120 });
    expect(response.status).toBe(422);
    expect((await list(a))[0]?.scaleValueMm).toBe(16);
  });

  it('moves to a free distance; to a taken one it is a 409 unless it replaces', async () => {
    const a = await archer();
    const mine = await record(a, { distanceM: 30, scaleValueMm: 8 });
    const other = await record(a, { distanceM: 50, scaleValueMm: 25 });
    expect((await patch(a, mine, { distanceM: 35 })).status).toBe(200);

    const clash = await patch(a, mine, { distanceM: 50 }, 2);
    expect(clash.status).toBe(409);
    expect(await errorOf(clash)).toMatchObject({
      code: 'SM-MARK-409-001',
      params: { existingMarkId: other, distanceM: 50 },
    });

    const taken = await patch(a, mine, { distanceM: 50, replace: true }, 2);
    expect(taken.status).toBe(200);
    expect((await list(a)).map((m) => [m.id, m.distanceM])).toEqual([[mine, 50]]);
  });

  it('refuses a stale version with 412 and the current one (HU-MRK-03), and a missing one with 428', async () => {
    const a = await archer();
    const id = await record(a);
    await patch(a, id, { note: 'first' });
    const stale = await patch(a, id, { note: 'second' }, 1);
    expect(stale.status).toBe(412);
    expect((await errorOf(stale)).params).toMatchObject({ currentVersion: 2 });
    expect((await patch(a, id, { note: 'x' }, null)).status).toBe(428);
    expect((await list(a))[0]).toMatchObject({ note: 'first' });
  });

  it('is a 404 for a mark that does not exist', async () => {
    const a = await archer();
    expect((await patch(a, uuidv7(), { note: 'x' })).status).toBe(404);
  });
});

describe('DELETE and restore: "Deshacer"', () => {
  it('deletes softly, and undoes it', async () => {
    const a = await archer();
    const id = await record(a);
    expect((await remove(a, id)).status).toBe(204);
    expect(await list(a)).toEqual([]);
    const stored = await connection.db?.collection('marks').findOne({ _id: id as never });
    expect(stored?.['deletedAt']).toBeInstanceOf(Date);

    const back = await call(a.user, 'POST', `/api/v1/marks/${id}/restore`);
    expect(back.status).toBe(200);
    expect(await bodyOf(back)).toMatchObject({ id, deletedAt: null, version: 3 });
    expect(await list(a)).toHaveLength(1);
  });

  it('refuses a stale (412) or missing (428) version on delete, and a mark that is not there (404)', async () => {
    const a = await archer();
    const id = await record(a);
    await patch(a, id, { note: 'x' });
    expect((await remove(a, id, 1)).status).toBe(412);
    expect((await call(a.user, 'DELETE', `/api/v1/marks/${id}`)).status).toBe(428);
    expect((await remove(a, uuidv7())).status).toBe(404);
  });

  it('will not undo after 30 days (SM-MARK-410-001)', async () => {
    const a = await archer();
    const id = await record(a);
    await remove(a, id);
    const before = now;
    now = now.add({ hours: 30 * 24 + 1 });
    const late = await call(a.user, 'POST', `/api/v1/marks/${id}/restore`);
    expect(late.status).toBe(410);
    expect((await errorOf(late)).code).toBe('SM-MARK-410-001');
    now = before;
  });

  it('will not undo into a distance that has a mark again (SM-MARK-409-001)', async () => {
    const a = await archer();
    const id = await record(a);
    await remove(a, id);
    const second = await record(a, { scaleValueMm: 20 });
    const back = await call(a.user, 'POST', `/api/v1/marks/${id}/restore`);
    expect(back.status).toBe(409);
    expect((await errorOf(back)).params).toMatchObject({ existingMarkId: second });
  });

  it('is a 404 to undo a mark that is alive', async () => {
    const a = await archer();
    const id = await record(a);
    expect((await call(a.user, 'POST', `/api/v1/marks/${id}/restore`)).status).toBe(404);
  });
});

describe('the marks follow their setup (RN-STP-06)', () => {
  it('go to the trash with it and come back with it, but not the one deleted on its own', async () => {
    const a = await archer();
    const kept = await record(a, { distanceM: 20, scaleValueMm: 3 });
    const gone = await record(a, { distanceM: 30, scaleValueMm: 8 });
    await remove(a, gone);

    expect((await trashSetup(a)).status).toBe(204);
    const inTrash = await connection.db?.collection('marks').countDocuments({
      setupId: a.setupId,
      deletedAt: { $ne: null },
    });
    expect(inTrash).toBe(2);

    const trashed = await bodyOf<{ items: { id: string; marksCount: number }[] }>(
      await call(a.user, 'GET', '/api/v1/setups/trash'),
    );
    expect(trashed.items.find((s) => s.id === a.setupId)?.marksCount).toBe(0);

    expect((await call(a.user, 'POST', `/api/v1/setups/${a.setupId}/restore`)).status).toBe(200);
    expect((await list(a)).map((m) => m.id)).toEqual([kept]);
  });

  it('the setup is not trashed if its marks cannot be: one transaction', async () => {
    const a = await archer();
    await record(a);
    // A stale version fails the setup\'s write, which must leave its marks untouched.
    const stale = await call(a.user, 'DELETE', `/api/v1/setups/${a.setupId}`, {
      headers: { 'if-match': '"9"' },
    });
    expect(stale.status).toBe(412);
    expect(await list(a)).toHaveLength(1);
  });
});

describe('what the marks change for equipment and setups', () => {
  it('a bow, sight and arrow set with marks refuse to be deleted, with the real counts', async () => {
    const a = await archer();
    await record(a, { distanceM: 20, scaleValueMm: 3 });
    await record(a, { distanceM: 30, scaleValueMm: 8 });
    await record(a, { arrowSetId: a.otherArrowId, distanceM: 20, scaleValueMm: 4 });
    const gone = (path: string, id: string) =>
      call(a.user, 'DELETE', `${path}/${id}`, { headers: { 'if-match': '"1"' } });

    expect(await errorOf(await gone('/api/v1/bows', a.bowId))).toMatchObject({
      code: 'SM-BOW-409-001',
      params: { setups: 1, marks: 3 },
    });
    expect(await errorOf(await gone('/api/v1/sights', a.sightId))).toMatchObject({
      params: { setups: 1, marks: 3 },
    });
    // Only the marks shot with that arrow set.
    expect(await errorOf(await gone('/api/v1/arrow-sets', a.arrowId))).toMatchObject({
      params: { setups: 1, marks: 2 },
    });
  });

  it('takes an arrow set out of a setup only when it has no marks (SM-STP-409-002)', async () => {
    const a = await archer();
    await record(a, { arrowSetId: a.otherArrowId, distanceM: 20, scaleValueMm: 4 });
    const refused = await call(a.user, 'PATCH', `/api/v1/setups/${a.setupId}`, {
      body: { arrowSetIds: [a.arrowId] },
      headers: { 'if-match': '"1"' },
    });
    expect(refused.status).toBe(409);
    expect(await errorOf(refused)).toMatchObject({
      code: 'SM-STP-409-002',
      params: { arrowSetId: a.otherArrowId, marks: 1 },
    });
    // The one without marks goes freely.
    const fine = await call(a.user, 'PATCH', `/api/v1/setups/${a.setupId}`, {
      body: { arrowSetIds: [a.otherArrowId] },
      headers: { 'if-match': '"1"' },
    });
    expect(fine.status).toBe(200);
  });
});

describe('changing the scale of a sight that has marks (HU-SGT-02, test no negociable 5)', () => {
  const MM = { unit: 'mm', min: 0, max: 100, resolution: 1, direction: 'down' };
  const changeScale = (a: Archer, scale: unknown, strategy?: string, version = 1) =>
    call(a.user, 'PATCH', `/api/v1/sights/${a.sightId}`, {
      body: { scale, ...(strategy === undefined ? {} : { scaleChangeStrategy: strategy }) },
      headers: { 'if-match': `"${version}"` },
    });
  const positions = async (a: Archer) => (await list(a)).map((m) => m.scaleValueMm);

  it('asks what to keep when the unit changes, and writes nothing', async () => {
    const a = await archer();
    await record(a, { scaleValueMm: 16 });
    const response = await changeScale(a, MM);
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatchObject({ code: 'SM-SGT-409-003', params: { marks: 1 } });
    expect(await positions(a)).toEqual([16]);
    expect(await bodyOf(await call(a.user, 'GET', `/api/v1/sights/${a.sightId}`))).toMatchObject({
      version: 1,
      scale: { unit: 'cm' },
    });
  });

  it('keepReadings: 1.6 cm becomes 1.6 mm, so the position follows the unit', async () => {
    const a = await archer();
    await record(a, { distanceM: 20, scaleValueMm: 16 });
    await record(a, { distanceM: 30, scaleValueMm: 32 });
    expect((await changeScale(a, MM, 'keepReadings')).status).toBe(200);
    expect(await positions(a)).toEqual([1.6, 3.2]);
  });

  it('keepPositions: the marks stay where they are on the metal', async () => {
    const a = await archer();
    await record(a, { distanceM: 20, scaleValueMm: 16 });
    expect((await changeScale(a, MM, 'keepPositions')).status).toBe(200);
    expect(await positions(a)).toEqual([16]);
  });

  it('refuses a change that leaves marks off the scale, with how many, and writes nothing (SM-SGT-409-002)', async () => {
    const a = await archer();
    await record(a, { distanceM: 20, scaleValueMm: 5 });
    await record(a, { distanceM: 30, scaleValueMm: 30 });
    await record(a, { distanceM: 40, scaleValueMm: 60 });
    // 0 to 4 cm is 0 to 40 mm: the 60 mm mark is off it.
    const response = await changeScale(a, { ...CM, max: 4 });
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatchObject({
      code: 'SM-SGT-409-002',
      params: { count: 1, minMm: 0, maxMm: 40 },
    });
    expect(await positions(a)).toEqual([5, 30, 60]);
  });

  it('checks the new scale against the marks after the readings are kept', async () => {
    const a = await archer();
    // 90 mm is on the cm scale; kept as a reading (9 cm) in mm it is 9 mm, still inside 0-100.
    await record(a, { scaleValueMm: 90 });
    expect((await changeScale(a, MM, 'keepReadings')).status).toBe(200);
    expect(await positions(a)).toEqual([9]);
  });

  it('needs no strategy when only the range, the step or the direction change', async () => {
    const a = await archer();
    await record(a, { scaleValueMm: 16 });
    const response = await changeScale(a, { ...CM, max: 12, resolution: 0.5, direction: 'up' });
    expect(response.status).toBe(200);
    expect(await positions(a)).toEqual([16]);
  });

  it('applies to the marks of every setup that uses the sight, of every arrow set', async () => {
    const a = await archer();
    await record(a, { distanceM: 20, scaleValueMm: 20 });
    await record(a, { arrowSetId: a.otherArrowId, distanceM: 20, scaleValueMm: 40 });
    const secondBow = await add(a.user, '/api/v1/bows', { bowType: 'compound', model: 'Second' });
    const second = await add(a.user, '/api/v1/setups', {
      bowId: secondBow,
      sightId: a.sightId,
      arrowSetIds: [a.arrowId],
    });
    await call(a.user, 'POST', '/api/v1/marks', {
      body: {
        id: uuidv7(),
        setupId: second,
        arrowSetId: a.arrowId,
        distanceM: 20,
        scaleValueMm: 60,
      },
    });

    expect((await changeScale(a, MM, 'keepReadings')).status).toBe(200);
    expect(await positions(a)).toEqual([2]);
    expect(await list(a, a.otherArrowId).then((m) => m.map((x) => x.scaleValueMm))).toEqual([4]);
    const other = await bodyOf<{ items: { scaleValueMm: number }[] }>(
      await call(a.user, 'GET', `/api/v1/setups/${second}/marks?arrowSetId=${a.arrowId}`),
    );
    expect(other.items.map((m) => m.scaleValueMm)).toEqual([6]);
  });
});

describe('purgeDeletedSetups also empties the marks', () => {
  it('removes marks deleted more than 30 days ago, with or without their setup', async () => {
    const a = await archer();
    const old = await record(a, { distanceM: 20, scaleValueMm: 3 });
    const recent = await record(a, { distanceM: 30, scaleValueMm: 8 });
    const live = await record(a, { distanceM: 40, scaleValueMm: 16 });
    await remove(a, old);
    const before = now;
    now = now.add({ hours: 20 * 24 });
    await remove(a, recent);
    now = now.add({ hours: 11 * 24 });

    const result = await purgeDeletedSetups.run({
      now,
      connection,
      logger: createLogger({ level: 'silent' }),
    });
    expect(result['marksDeleted']).toBeGreaterThanOrEqual(1);
    const docs = connection.db?.collection('marks');
    expect(await docs?.countDocuments({ _id: old as never })).toBe(0);
    expect(await docs?.countDocuments({ _id: recent as never })).toBe(1);
    expect(await docs?.countDocuments({ _id: live as never })).toBe(1);
    now = before;
  });
});

describe('isolation of the mark routes (spec 13)', () => {
  it('keeps one archer out of reach of another, route by route', async () => {
    expect(
      await checkIsolation(container.app, container.registry.routes, productionAttacks),
    ).toEqual([]);
  });
});
