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

const START = Temporal.Instant.from('2026-11-02T12:00:00Z');
let now = START;
const clock: Clock = { now: () => now };
const tick = () => void (now = now.add({ seconds: 1 }));

/** The marks arrive with F1-07: here a setup can be given marks on demand. */
const marks = new Map<string, Map<string, number>>();
const marksOf = (setupId: string) => marks.get(setupId) ?? new Map<string, number>();

beforeAll(async () => {
  replSet = await startReplSet();
  const logger = createLogger({ level: 'silent' });
  connection = await connectMongo(replSet.getUri('sightmapper_setups'), logger);
  container = createContainer({
    env: testEnv,
    logger,
    connection,
    clock,
    session: fakeSession,
    idempotencyStore: createMongoIdempotencyStore(connection, clock),
    setupMarks: {
      countBySetup: (_userId, setupIds) =>
        Promise.resolve(
          new Map(setupIds.map((id) => [id, [...marksOf(id).values()].reduce((a, b) => a + b, 0)])),
        ),
      countForArrowSet: (_userId, setupId, arrowSetId) =>
        Promise.resolve(marksOf(setupId).get(arrowSetId) ?? 0),
    },
  });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

let counter = 0;
const newUser = () => `setup-user-${(counter += 1)}`;

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

const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };

async function add(user: string, path: string, body: Record<string, unknown>) {
  const id = uuidv7();
  const response = await call(user, 'POST', path, { body: { id, ...body } });
  expect(response.status).toBe(201);
  return id;
}
const addBow = (user: string, model = 'Alpha') =>
  add(user, '/api/v1/bows', { bowType: 'compound', model });
const addSight = (user: string, model = 'Ultraview') =>
  add(user, '/api/v1/sights', { model, pinType: 'dualpin', scale: SCALE });
const addArrows = (user: string, name = 'Hunter 400') => add(user, '/api/v1/arrow-sets', { name });

/** An archer with one of each kind of equipment, ready to build setups. */
async function equipped(user = newUser()) {
  return {
    user,
    bowId: await addBow(user),
    sightId: await addSight(user),
    arrowId: await addArrows(user),
  };
}

async function addSetup(
  user: string,
  parts: { bowId: string; sightId: string; arrowSetIds: string[] },
  extra: Record<string, unknown> = {},
) {
  const id = uuidv7();
  const response = await call(user, 'POST', '/api/v1/setups', { body: { id, ...parts, ...extra } });
  expect(response.status).toBe(201);
  return id;
}

const patch = (user: string, id: string, body: unknown, version: number | null = 1) =>
  call(user, 'PATCH', `/api/v1/setups/${id}`, {
    body,
    headers: version === null ? {} : { 'if-match': `"${version}"` },
  });
const trash = (user: string, id: string, version = 1) =>
  call(user, 'DELETE', `/api/v1/setups/${id}`, { headers: { 'if-match': `"${version}"` } });
const ids = async (response: Response) =>
  (await bodyOf<{ items: { id: string }[] }>(response)).items.map((s) => s.id);

describe('POST /setups (HU-STP-01)', () => {
  it('creates a setup and answers it with its bow, sight and scale, arrow sets and mark count', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = uuidv7();
    const response = await call(user, 'POST', '/api/v1/setups', {
      body: { id, bowId, sightId, arrowSetIds: [arrowId], name: 'Caza' },
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    const view = await bodyOf(response);
    expect(view).toMatchObject({
      id,
      name: 'Caza',
      isFavorite: false,
      status: 'active',
      version: 1,
      deletedAt: null,
      marksCount: 0,
      bow: { id: bowId, model: 'Alpha', status: 'active' },
      sight: { id: sightId, pinType: 'dualpin', scale: SCALE },
      arrowSets: [{ id: arrowId, name: 'Hunter 400', status: 'active' }],
    });
    expect(view).not.toHaveProperty('userId');
  });

  it('takes several arrow sets, in the order the archer gave them', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const second = await addArrows(user, 'Pierce 400');
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [second, arrowId] });
    const view = await bodyOf<{ arrowSets: { name: string }[] }>(
      await call(user, 'GET', `/api/v1/setups/${id}`),
    );
    expect(view.arrowSets.map((a) => a.name)).toEqual(['Pierce 400', 'Hunter 400']);
  });

  it('is idempotent: the same key three times makes one setup and the same answer', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const key = uuidv7();
    const body = { id: uuidv7(), bowId, sightId, arrowSetIds: [arrowId] };
    const answers = [];
    for (let i = 0; i < 3; i++) {
      const response = await call(user, 'POST', '/api/v1/setups', {
        body,
        headers: { 'idempotency-key': key },
      });
      expect(response.status).toBe(201);
      answers.push(await response.text());
    }
    expect(new Set(answers).size).toBe(1);
    expect(await connection.db?.collection('setups').countDocuments({ userId: user })).toBe(1);
  });

  it('refuses a second setup with the same bow and sight, naming the first (SM-STP-409-001)', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const first = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    const other = await addArrows(user, 'Other');
    const again = await call(user, 'POST', '/api/v1/setups', {
      body: { id: uuidv7(), bowId, sightId, arrowSetIds: [other] },
    });
    expect(again.status).toBe(409);
    expect(await errorOf(again)).toMatchObject({
      code: 'SM-STP-409-001',
      params: { existingSetupId: first },
    });
  });

  it('lets the same bow go with another sight (RN-STP-02)', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    const otherSight = await addSight(user, 'Second');
    expect(
      (
        await call(user, 'POST', '/api/v1/setups', {
          body: { id: uuidv7(), bowId, sightId: otherSight, arrowSetIds: [arrowId] },
        })
      ).status,
    ).toBe(201);
  });

  it("refuses equipment that is archived, missing or somebody else's (SM-STP-422-001), naming which", async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    await call(user, 'POST', `/api/v1/arrow-sets/${arrowId}/archive`);
    const archived = await call(user, 'POST', '/api/v1/setups', {
      body: { id: uuidv7(), bowId, sightId, arrowSetIds: [arrowId] },
    });
    expect(archived.status).toBe(422);
    expect(await errorOf(archived)).toMatchObject({
      code: 'SM-STP-422-001',
      params: { kind: 'arrowSet', id: arrowId },
    });

    const ghost = uuidv7();
    const missing = await call(user, 'POST', '/api/v1/setups', {
      body: { id: uuidv7(), bowId: ghost, sightId, arrowSetIds: [arrowId] },
    });
    expect(await errorOf(missing)).toMatchObject({ params: { kind: 'bow', id: ghost } });

    const stranger = await addBow(newUser());
    const foreign = await call(user, 'POST', '/api/v1/setups', {
      body: { id: uuidv7(), bowId: stranger, sightId, arrowSetIds: [arrowId] },
    });
    expect((await errorOf(foreign)).params).toMatchObject({ kind: 'bow', id: stranger });
  });

  it.each([
    ['no arrow sets', { arrowSetIds: [] }],
    ['a repeated arrow set', { arrowSetIds: ['x', 'x'] }],
    ['no bow', { bowId: undefined }],
  ])('rejects %s with SM-CORE-400-001', async (_name, over) => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const body = { id: uuidv7(), bowId, sightId, arrowSetIds: [arrowId], ...over };
    const response = await call(user, 'POST', '/api/v1/setups', { body });
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe('SM-CORE-400-001');
  });

  it('needs a session', async () => {
    expect((await call(null, 'POST', '/api/v1/setups', { body: {} })).status).toBe(401);
  });
});

describe('GET /setups: the Home (HU-STP-02)', () => {
  it('puts the favourite first, then the rest by latest edit', async () => {
    const user = newUser();
    const made: string[] = [];
    for (let i = 0; i < 4; i++) {
      tick();
      const { bowId, sightId, arrowId } = await equipped(user);
      made.push(await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] }));
    }
    const [first, second, third, fourth] = made as [string, string, string, string];
    tick();
    await patch(user, second, { isFavorite: true });

    expect(await ids(await call(user, 'GET', '/api/v1/setups'))).toEqual([
      second,
      fourth,
      third,
      first,
    ]);
  });

  it('pages without repeating or skipping, favourites included', async () => {
    const user = newUser();
    const made: string[] = [];
    for (let i = 0; i < 5; i++) {
      tick();
      const { bowId, sightId, arrowId } = await equipped(user);
      made.push(await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] }));
    }
    tick();
    await patch(user, made[1] as string, { isFavorite: true });
    const expected = [made[1], made[4], made[3], made[2], made[0]];

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page++) {
      const response = await call(
        user,
        'GET',
        `/api/v1/setups?limit=2${cursor === null ? '' : `&cursor=${cursor}`}`,
      );
      const body = await bodyOf<{ items: { id: string }[]; nextCursor: string | null }>(response);
      seen.push(...body.items.map((s) => s.id));
      cursor = body.nextCursor;
      if (cursor === null) break;
    }
    expect(seen).toEqual(expected);
  });

  it('shows how many marks each setup holds, and hides archived ones unless asked', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    marks.set(id, new Map([[arrowId, 12]]));
    expect(await bodyOf(await call(user, 'GET', '/api/v1/setups'))).toMatchObject({
      items: [{ id, marksCount: 12 }],
    });
    await call(user, 'POST', `/api/v1/setups/${id}/archive`);
    expect(await ids(await call(user, 'GET', '/api/v1/setups'))).toEqual([]);
    expect(await ids(await call(user, 'GET', '/api/v1/setups?status=archived'))).toEqual([id]);
  });

  it('is empty for an archer with no setups, and rejects a cursor it cannot read', async () => {
    const user = newUser();
    expect(await bodyOf(await call(user, 'GET', '/api/v1/setups'))).toEqual({
      items: [],
      nextCursor: null,
    });
    expect((await call(user, 'GET', '/api/v1/setups?cursor=not-a-cursor')).status).toBe(400);
  });
});

describe('PATCH /setups/:id', () => {
  it('renames, favours and sends the new ETag', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    const response = await patch(user, id, { name: 'Torneo', isFavorite: true });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(await bodyOf(response)).toMatchObject({ name: 'Torneo', isFavorite: true, version: 2 });
  });

  it('clears the name with null, and never changes the bow or the sight', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] }, { name: 'X' });
    const response = await patch(user, id, { name: null, bowId: uuidv7(), sightId: uuidv7() });
    const view = await bodyOf(response);
    expect(view).not.toHaveProperty('name');
    expect(view).toMatchObject({ bowId, sightId });
  });

  it("adds an arrow set, but only an active one of the archer's (SM-STP-422-001)", async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    const second = await addArrows(user, 'Second');
    const added = await patch(user, id, { arrowSetIds: [arrowId, second] });
    expect((await bodyOf<{ arrowSetIds: string[] }>(added)).arrowSetIds).toEqual([arrowId, second]);

    const stranger = await addArrows(newUser());
    const refused = await patch(user, id, { arrowSetIds: [arrowId, second, stranger] }, 2);
    expect(refused.status).toBe(422);
    expect((await errorOf(refused)).params).toMatchObject({ kind: 'arrowSet', id: stranger });
  });

  it('refuses to take away an arrow set that has marks (SM-STP-409-002, RN-STP-05)', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const second = await addArrows(user, 'Second');
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId, second] });
    marks.set(id, new Map([[second, 3]]));
    const response = await patch(user, id, { arrowSetIds: [arrowId] });
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatchObject({
      code: 'SM-STP-409-002',
      params: { arrowSetId: second, marks: 3 },
    });
    // One without marks goes without trouble.
    marks.set(id, new Map());
    expect((await patch(user, id, { arrowSetIds: [arrowId] })).status).toBe(200);
  });

  it('cannot be left without arrow sets', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    expect((await patch(user, id, { arrowSetIds: [] })).status).toBe(400);
  });

  it('refuses a stale version with 412 and a missing one with 428', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    await patch(user, id, { name: 'first' });
    const stale = await patch(user, id, { name: 'second' }, 1);
    expect(stale.status).toBe(412);
    expect((await errorOf(stale)).params).toMatchObject({ currentVersion: 2 });
    expect((await patch(user, id, { name: 'x' }, null)).status).toBe(428);
  });
});

describe('the protected delete of equipment uses the real count (ADR-008)', () => {
  it('refuses to delete a bow, sight or arrow set a setup uses, with the count', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    marks.set(id, new Map([[arrowId, 14]]));
    const gone = (path: string, itemId: string) =>
      call(user, 'DELETE', `${path}/${itemId}`, { headers: { 'if-match': '"1"' } });

    const bow = await gone('/api/v1/bows', bowId);
    expect(bow.status).toBe(409);
    expect(await errorOf(bow)).toMatchObject({
      code: 'SM-BOW-409-001',
      params: { setups: 1, marks: 14 },
    });
    expect(await errorOf(await gone('/api/v1/sights', sightId))).toMatchObject({
      code: 'SM-SGT-409-001',
      params: { setups: 1, marks: 14 },
    });
    expect(await errorOf(await gone('/api/v1/arrow-sets', arrowId))).toMatchObject({
      code: 'SM-ARW-409-001',
      params: { setups: 1, marks: 14 },
    });
  });

  it('counts only the marks shot with that arrow set, and lets go once the setup is gone', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const second = await addArrows(user, 'Second');
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId, second] });
    marks.set(
      id,
      new Map([
        [arrowId, 5],
        [second, 2],
      ]),
    );
    const detail = await bodyOf(await call(user, 'GET', `/api/v1/arrow-sets/${second}`));
    expect(detail).toMatchObject({ usage: { setups: 1, marks: 2 } });

    // A setup in the trash no longer holds its components.
    await trash(user, id);
    const del = await call(user, 'DELETE', `/api/v1/bows/${bowId}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(del.status).toBe(204);
  });

  it('keeps counting an archived setup: archiving does not free the bow', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    await call(user, 'POST', `/api/v1/setups/${id}/archive`);
    const del = await call(user, 'DELETE', `/api/v1/bows/${bowId}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(del.status).toBe(409);
  });
});

describe('the trash (HU-STP-04)', () => {
  it('sends a setup to the trash and shows it there with the day it will be purged', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    expect((await trash(user, id)).status).toBe(204);

    expect(await ids(await call(user, 'GET', '/api/v1/setups'))).toEqual([]);
    expect((await call(user, 'GET', `/api/v1/setups/${id}`)).status).toBe(404);
    const trashed = await bodyOf<{ items: { id: string; purgeAt: string; deletedAt: string }[] }>(
      await call(user, 'GET', '/api/v1/setups/trash'),
    );
    expect(trashed.items.map((s) => s.id)).toEqual([id]);
    const deletedAt = Temporal.Instant.from(trashed.items[0]?.deletedAt ?? '');
    expect(Temporal.Instant.from(trashed.items[0]?.purgeAt ?? '').epochMilliseconds).toBe(
      deletedAt.add({ hours: 30 * 24 }).epochMilliseconds,
    );
  });

  it('refuses a stale version (412) and a missing one (428) on delete', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    await patch(user, id, { name: 'x' });
    expect((await trash(user, id, 1)).status).toBe(412);
    expect((await call(user, 'DELETE', `/api/v1/setups/${id}`)).status).toBe(428);
  });

  it('restores a setup with its equipment, and answers 404 for one that is not in the trash', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    await trash(user, id);
    const restored = await call(user, 'POST', `/api/v1/setups/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(await bodyOf(restored)).toMatchObject({ id, deletedAt: null, bow: { id: bowId } });
    expect(await ids(await call(user, 'GET', '/api/v1/setups'))).toEqual([id]);
    expect((await call(user, 'POST', `/api/v1/setups/${id}/restore`)).status).toBe(404);
  });

  it('refuses to restore after 30 days (SM-STP-410-001)', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    await trash(user, id);
    const before = now;
    now = now.add({ hours: 30 * 24 + 1 });
    const late = await call(user, 'POST', `/api/v1/setups/${id}/restore`);
    expect(late.status).toBe(410);
    expect((await errorOf(late)).code).toBe('SM-STP-410-001');
    now = before;
  });

  it('frees the pair while a setup is in the trash, and refuses the restore if it was taken', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const first = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    await trash(user, first);
    const replacement = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    const restore = await call(user, 'POST', `/api/v1/setups/${first}/restore`);
    expect(restore.status).toBe(409);
    expect(await errorOf(restore)).toMatchObject({
      code: 'SM-STP-409-001',
      params: { existingSetupId: replacement },
    });
  });
});

describe('archive and unarchive', () => {
  it('moves a setup out of the active list and back, idempotently', async () => {
    const { user, bowId, sightId, arrowId } = await equipped();
    const id = await addSetup(user, { bowId, sightId, arrowSetIds: [arrowId] });
    const archived = await call(user, 'POST', `/api/v1/setups/${id}/archive`);
    expect(await bodyOf(archived)).toMatchObject({ status: 'archived', version: 2 });
    const back = await call(user, 'POST', `/api/v1/setups/${id}/unarchive`);
    expect(await bodyOf(back)).toMatchObject({ status: 'active', version: 3 });
    expect((await call(user, 'POST', `/api/v1/setups/${uuidv7()}/archive`)).status).toBe(404);
  });
});

describe('purgeDeletedSetups (SPEC 12)', () => {
  const run = () =>
    purgeDeletedSetups.run({ now, connection, logger: createLogger({ level: 'silent' }) });

  it('removes the setups deleted more than 30 days ago, of every archer, and nothing else', async () => {
    const a = await equipped();
    const b = await equipped();
    const old = await addSetup(a.user, {
      bowId: a.bowId,
      sightId: a.sightId,
      arrowSetIds: [a.arrowId],
    });
    const oldOfB = await addSetup(b.user, {
      bowId: b.bowId,
      sightId: b.sightId,
      arrowSetIds: [b.arrowId],
    });
    await trash(a.user, old);
    await trash(b.user, oldOfB);

    const recent = await equipped();
    const kept = await addSetup(recent.user, {
      bowId: recent.bowId,
      sightId: recent.sightId,
      arrowSetIds: [recent.arrowId],
    });
    const live = await equipped();
    const alive = await addSetup(live.user, {
      bowId: live.bowId,
      sightId: live.sightId,
      arrowSetIds: [live.arrowId],
    });

    const before = now;
    now = now.add({ hours: 20 * 24 });
    await trash(recent.user, kept);
    now = now.add({ hours: 11 * 24 });
    const first = await run();
    expect(first.deleted).toBeGreaterThanOrEqual(2);

    const docs = connection.db?.collection('setups');
    expect(await docs?.countDocuments({ _id: old as never })).toBe(0);
    expect(await docs?.countDocuments({ _id: oldOfB as never })).toBe(0);
    expect(await docs?.countDocuments({ _id: kept as never })).toBe(1);
    expect(await docs?.countDocuments({ _id: alive as never })).toBe(1);
    expect((await run()).deleted).toBe(0);
    now = before;
  });
});

describe('isolation of the setup routes (spec 13, test no negociable 4)', () => {
  it('keeps one archer out of reach of another, route by route', async () => {
    expect(
      await checkIsolation(container.app, container.registry.routes, productionAttacks),
    ).toEqual([]);
  });
});
