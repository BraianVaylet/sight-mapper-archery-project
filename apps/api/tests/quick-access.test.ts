import type { ErrorEnvelope } from '@sight-mapper/types';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '../src/composition-root.js';
import { fixedClock } from '../src/core/clock/clock.js';
import { connectMongo } from '../src/core/db/connection.js';
import { createMongoIdempotencyStore } from '../src/core/idempotency/mongo-store.js';
import { createLogger } from '../src/core/logger/logger.js';
import { fakeSession, testEnv } from './helpers/app.js';
import { startReplSet } from './helpers/mongo.js';

// HU-STP-03 / RN-STP-07: the setup and arrow set the app opens on.

let replSet: MongoMemoryReplSet;
let connection: Connection;
let container: ReturnType<typeof createContainer>;

beforeAll(async () => {
  replSet = await startReplSet();
  const logger = createLogger({ level: 'silent' });
  connection = await connectMongo(replSet.getUri('sightmapper_quick_access'), logger);
  const clock = fixedClock('2026-11-02T12:00:00Z');
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
const newUser = () => `quick-user-${(counter += 1)}`;

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

type Profile = { quickAccess: { setupId: string; arrowSetId: string } | null; version: number };
const bodyOf = async <T = Record<string, unknown>>(response: Response) =>
  (await response.json()) as T;
const errorOf = async (response: Response) => (await bodyOf<ErrorEnvelope>(response)).error;
const me = async (user: string) => bodyOf<Profile>(await call(user, 'GET', '/api/v1/me'));

const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };
async function add(user: string, path: string, body: Record<string, unknown>) {
  const id = uuidv7();
  expect((await call(user, 'POST', path, { body: { id, ...body } })).status).toBe(201);
  return id;
}

/** A setup with two arrow sets, and a third one the archer has but the setup does not. */
async function seed(user: string, model = 'Alpha') {
  const bowId = await add(user, '/api/v1/bows', { bowType: 'compound', model });
  const sightId = await add(user, '/api/v1/sights', {
    model: `Sight ${model}`,
    pinType: 'dualpin',
    scale: SCALE,
  });
  const first = await add(user, '/api/v1/arrow-sets', { name: 'Hunter 400' });
  const second = await add(user, '/api/v1/arrow-sets', { name: 'Pierce 400' });
  const outside = await add(user, '/api/v1/arrow-sets', { name: 'Not in the setup' });
  const setupId = uuidv7();
  const created = await call(user, 'POST', '/api/v1/setups', {
    body: { id: setupId, bowId, sightId, arrowSetIds: [first, second] },
  });
  expect(created.status).toBe(201);
  return { setupId, first, second, outside };
}

const put = (user: string, body: unknown, version: number | null) =>
  call(user, 'PUT', '/api/v1/me/quick-access', {
    body,
    headers: version === null ? {} : { 'if-match': `"${version}"` },
  });

describe('PUT /me/quick-access (HU-STP-03)', () => {
  it('sets the pair the app opens on, bumps the version and shows it in GET /me', async () => {
    const user = newUser();
    const s = await seed(user);
    const before = await me(user);
    expect(before.quickAccess).toBeNull();

    const response = await put(user, { setupId: s.setupId, arrowSetId: s.second }, before.version);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(`"${before.version + 1}"`);
    const body = await bodyOf<Profile>(response);
    expect(body.quickAccess).toEqual({ setupId: s.setupId, arrowSetId: s.second });
    expect(body).not.toHaveProperty('userId');
    expect((await me(user)).quickAccess).toEqual({ setupId: s.setupId, arrowSetId: s.second });
  });

  it('keeps at most one: a second pair replaces the first (RN-STP-07)', async () => {
    const user = newUser();
    const a = await seed(user, 'Alpha');
    const b = await seed(user, 'Beta');
    let version = (await me(user)).version;
    version = (
      await bodyOf<Profile>(await put(user, { setupId: a.setupId, arrowSetId: a.first }, version))
    ).version;
    const second = await bodyOf<Profile>(
      await put(user, { setupId: b.setupId, arrowSetId: b.first }, version),
    );
    expect(second.quickAccess).toEqual({ setupId: b.setupId, arrowSetId: b.first });
  });

  it('clears it with null', async () => {
    const user = newUser();
    const s = await seed(user);
    let version = (await me(user)).version;
    version = (
      await bodyOf<Profile>(await put(user, { setupId: s.setupId, arrowSetId: s.first }, version))
    ).version;
    const cleared = await put(user, null, version);
    expect(cleared.status).toBe(200);
    expect((await bodyOf<Profile>(cleared)).quickAccess).toBeNull();
  });

  it('refuses an arrow set that is not in the setup: SM-ACC-422-001', async () => {
    const user = newUser();
    const s = await seed(user);
    const version = (await me(user)).version;
    const response = await put(user, { setupId: s.setupId, arrowSetId: s.outside }, version);
    expect(response.status).toBe(422);
    expect((await errorOf(response)).code).toBe('SM-ACC-422-001');
    expect((await me(user)).quickAccess).toBeNull();
  });

  it("answers 404 for a setup that is not there, or is another archer's, and sets nothing", async () => {
    const owner = newUser();
    const other = newUser();
    const s = await seed(owner);
    const version = (await me(other)).version;

    const foreign = await put(other, { setupId: s.setupId, arrowSetId: s.first }, version);
    expect(foreign.status).toBe(404);
    expect((await errorOf(foreign)).code).toBe('SM-CORE-404-002');

    const missing = await put(other, { setupId: uuidv7(), arrowSetId: uuidv7() }, version);
    expect(missing.status).toBe(404);
    expect((await me(other)).quickAccess).toBeNull();
  });

  it('does not take a setup that is in the trash', async () => {
    const user = newUser();
    const s = await seed(user);
    const version = (await me(user)).version;
    const trashed = await call(user, 'DELETE', `/api/v1/setups/${s.setupId}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(trashed.status).toBe(204);
    const response = await put(user, { setupId: s.setupId, arrowSetId: s.first }, version);
    expect(response.status).toBe(404);
  });

  it('refuses a stale write (412) and one without If-Match (428)', async () => {
    const user = newUser();
    const s = await seed(user);
    const version = (await me(user)).version;
    const stale = await put(user, { setupId: s.setupId, arrowSetId: s.first }, version + 5);
    expect(stale.status).toBe(412);
    expect((await errorOf(stale)).code).toBe('SM-CORE-412-001');
    const missing = await put(user, { setupId: s.setupId, arrowSetId: s.first }, null);
    expect(missing.status).toBe(428);
  });

  it('is the same result when it is sent twice with the version it made (idempotent by nature)', async () => {
    const user = newUser();
    const s = await seed(user);
    const v1 = (await me(user)).version;
    const first = await bodyOf<Profile>(
      await put(user, { setupId: s.setupId, arrowSetId: s.first }, v1),
    );
    const second = await bodyOf<Profile>(
      await put(user, { setupId: s.setupId, arrowSetId: s.first }, first.version),
    );
    expect(second.quickAccess).toEqual(first.quickAccess);
  });

  it('validates the body: ids must be UUIDs, and a half pair is no pair', async () => {
    const user = newUser();
    const version = (await me(user)).version;
    expect((await put(user, { setupId: 'nope', arrowSetId: 'nope' }, version)).status).toBe(400);
    expect((await put(user, { setupId: uuidv7() }, version)).status).toBe(400);
  });

  it('needs a session', async () => {
    const response = await call(null, 'PUT', '/api/v1/me/quick-access', {
      body: null,
      headers: { 'if-match': '"1"' },
    });
    expect(response.status).toBe(401);
  });
});

describe('deleting the setup clears the quick access (RN-STP-07)', () => {
  it('sending the setup to the trash empties the quick access that pointed at it', async () => {
    const user = newUser();
    const s = await seed(user);
    const version = (await me(user)).version;
    await put(user, { setupId: s.setupId, arrowSetId: s.first }, version);

    const trashed = await call(user, 'DELETE', `/api/v1/setups/${s.setupId}`, {
      headers: { 'if-match': '"1"' },
    });
    expect(trashed.status).toBe(204);
    const after = await me(user);
    expect(after.quickAccess).toBeNull();
    // A version of its own: the client that held the old one is told to reload, not overwritten.
    expect(after.version).toBeGreaterThan(version + 1);
  });

  it('leaves a quick access that points at another setup alone', async () => {
    const user = newUser();
    const keep = await seed(user, 'Alpha');
    const drop = await seed(user, 'Beta');
    const version = (await me(user)).version;
    await put(user, { setupId: keep.setupId, arrowSetId: keep.first }, version);

    await call(user, 'DELETE', `/api/v1/setups/${drop.setupId}`, {
      headers: { 'if-match': '"1"' },
    });
    expect((await me(user)).quickAccess).toEqual({ setupId: keep.setupId, arrowSetId: keep.first });
  });

  it('does not bring it back when the setup is restored', async () => {
    const user = newUser();
    const s = await seed(user);
    const version = (await me(user)).version;
    await put(user, { setupId: s.setupId, arrowSetId: s.first }, version);
    await call(user, 'DELETE', `/api/v1/setups/${s.setupId}`, { headers: { 'if-match': '"1"' } });

    const restored = await call(user, 'POST', `/api/v1/setups/${s.setupId}/restore`);
    expect(restored.status).toBe(200);
    expect((await me(user)).quickAccess).toBeNull();
  });

  it("never touches another archer's profile", async () => {
    const a = newUser();
    const b = newUser();
    const sa = await seed(a);
    const sb = await seed(b);
    await put(a, { setupId: sa.setupId, arrowSetId: sa.first }, (await me(a)).version);
    await put(b, { setupId: sb.setupId, arrowSetId: sb.first }, (await me(b)).version);

    await call(a, 'DELETE', `/api/v1/setups/${sa.setupId}`, { headers: { 'if-match': '"1"' } });
    expect((await me(a)).quickAccess).toBeNull();
    expect((await me(b)).quickAccess).toEqual({ setupId: sb.setupId, arrowSetId: sb.first });
  });
});
