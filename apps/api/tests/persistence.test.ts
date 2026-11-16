import { Temporal } from '@js-temporal/polyfill';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection, Model } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixedClock } from '../src/core/clock/clock.js';
import { createBusinessSchema } from '../src/core/db/base-schema.js';
import { connectMongo } from '../src/core/db/connection.js';
import { toDate } from '../src/core/db/temporal.js';
import { rethrowDuplicateId, updateWithVersion } from '../src/core/db/versioned.js';
import { AppError } from '../src/core/http/errors.js';
import type { IdempotencyRecord } from '../src/core/idempotency/idempotency.js';
import { createMongoIdempotencyStore } from '../src/core/idempotency/mongo-store.js';
import { createLogger } from '../src/core/logger/logger.js';
import { startReplSet } from './helpers/mongo.js';

const NOW = Temporal.Instant.from('2026-10-30T12:00:00Z');
const at = toDate(NOW);

let replSet: MongoMemoryReplSet;
let connection: Connection;
let Bow: Model<{ _id: string; userId: string; version: number; nickname: string }>;

beforeAll(async () => {
  replSet = await startReplSet();
  connection = await connectMongo(
    replSet.getUri('sightmapper_persist'),
    createLogger({ level: 'silent' }),
  );
  Bow = connection.model(
    'Bow',
    createBusinessSchema({ nickname: String }),
  ) as unknown as typeof Bow;
  await Bow.init();
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

const record = (over: Partial<IdempotencyRecord> = {}): IdempotencyRecord => ({
  userId: 'ana',
  key: 'key-0001-abcdefgh',
  method: 'POST',
  path: '/api/v1/bows',
  requestHash: 'a'.repeat(64),
  statusCode: 201,
  responseBody: '{"id":"x"}',
  responseHeaders: { etag: '"1"' },
  createdAt: NOW,
  expiresAt: NOW.add({ hours: 24 }),
  ...over,
});

describe('Mongo idempotency store', () => {
  it('saves and finds a record, with instants and headers intact', async () => {
    const store = createMongoIdempotencyStore(connection, fixedClock('2026-10-30T12:00:00Z'));
    await store.save(record());
    const found = await store.find('ana', 'key-0001-abcdefgh');
    expect(found).toMatchObject({
      userId: 'ana',
      statusCode: 201,
      responseBody: '{"id":"x"}',
      responseHeaders: { etag: '"1"' },
    });
    expect(found?.expiresAt.toString()).toBe('2026-10-31T12:00:00Z');
  });

  it('never finds another user’s key', async () => {
    const store = createMongoIdempotencyStore(connection, fixedClock('2026-10-30T12:00:00Z'));
    await store.save(record({ key: 'shared-key-0001' }));
    expect(await store.find('beto', 'shared-key-0001')).toBeNull();
  });

  it('keeps the first response when the same key is saved twice', async () => {
    const store = createMongoIdempotencyStore(connection, fixedClock('2026-10-30T12:00:00Z'));
    await store.save(record({ key: 'dup-key-000001', responseBody: 'first' }));
    await store.save(record({ key: 'dup-key-000001', responseBody: 'second' }));
    expect((await store.find('ana', 'dup-key-000001'))?.responseBody).toBe('first');
  });

  it('ignores a record whose 24 h have passed, even before the TTL sweep removes it', async () => {
    const writer = createMongoIdempotencyStore(connection, fixedClock('2026-10-30T12:00:00Z'));
    await writer.save(record({ key: 'old-key-000001' }));
    const later = createMongoIdempotencyStore(connection, fixedClock('2026-10-31T12:00:01Z'));
    expect(await later.find('ana', 'old-key-000001')).toBeNull();
  });

  it('refuses a lookup that would not be scoped', async () => {
    const store = createMongoIdempotencyStore(connection, fixedClock('2026-10-30T12:00:00Z'));
    await expect(store.find(undefined as never, 'k')).rejects.toMatchObject({
      code: 'SM-CORE-500-002',
    });
  });
});

describe('updateWithVersion (test #7 at the repository)', () => {
  const seed = (id: string, userId = 'ana') =>
    Bow.create({
      _id: id,
      userId,
      version: 1,
      nickname: 'Hoyt',
      createdAt: at,
      updatedAt: at,
    } as never);
  const scope = (id: string, userId = 'ana') => ({ userId, id });

  it('updates and bumps the version when the client saw the current one', async () => {
    await seed('v1');
    const updated = await updateWithVersion(Bow, scope('v1'), 1, { nickname: 'Mathews' }, 'bow');
    expect(updated).toMatchObject({ nickname: 'Mathews', version: 2 });
  });

  it('is SM-CORE-412-001 with the current version when the client is behind', async () => {
    await seed('v2');
    await updateWithVersion(Bow, scope('v2'), 1, { nickname: 'B' }, 'bow');
    const error = await updateWithVersion(Bow, scope('v2'), 1, { nickname: 'C' }, 'bow').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'SM-CORE-412-001', params: { currentVersion: 2 } });
    expect((await Bow.findOne({ userId: 'ana', _id: 'v2' }))?.nickname).toBe('B');
  });

  it('is SM-CORE-404-002 for a missing or another user’s document, never 412 or 403', async () => {
    await seed('v3', 'ana');
    const foreign = await updateWithVersion(
      Bow,
      scope('v3', 'beto'),
      1,
      { nickname: 'x' },
      'bow',
    ).catch((e: unknown) => e);
    expect(foreign).toMatchObject({ code: 'SM-CORE-404-002', params: { resource: 'bow' } });
    const missing = await updateWithVersion(Bow, scope('nope'), 1, { nickname: 'x' }, 'bow').catch(
      (e: unknown) => e,
    );
    expect(missing).toMatchObject({ code: 'SM-CORE-404-002' });
    expect((await Bow.findOne({ userId: 'ana', _id: 'v3' }))?.nickname).toBe('Hoyt');
  });

  it('treats a soft-deleted document as not found', async () => {
    await Bow.create({
      _id: 'v4',
      userId: 'ana',
      version: 1,
      nickname: 'x',
      createdAt: at,
      updatedAt: at,
      deletedAt: at,
    } as never);
    const error = await updateWithVersion(Bow, scope('v4'), 1, { nickname: 'y' }, 'bow').catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ code: 'SM-CORE-404-002' });
  });

  it('keeps extra $inc fields and two racing writers apart: exactly one wins', async () => {
    await seed('v5');
    const results = await Promise.allSettled([
      updateWithVersion(Bow, scope('v5'), 1, { nickname: 'A' }, 'bow'),
      updateWithVersion(Bow, scope('v5'), 1, { nickname: 'B' }, 'bow'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected');
    expect(failed).toMatchObject({ reason: { code: 'SM-CORE-412-001' } });
    expect((await Bow.findOne({ userId: 'ana', _id: 'v5' }))?.version).toBe(2);
  });

  it('works inside a transaction session', async () => {
    await seed('v6');
    await connection.transaction(async (session) => {
      const updated = await updateWithVersion(
        Bow,
        scope('v6'),
        1,
        { nickname: 'T' },
        'bow',
        session,
      );
      expect(updated.version).toBe(2);
      const stale = await updateWithVersion(
        Bow,
        scope('v6'),
        1,
        { nickname: 'U' },
        'bow',
        session,
      ).catch((e: unknown) => e);
      expect(stale).toMatchObject({ code: 'SM-CORE-412-001' });
    });
  });
});

describe('rethrowDuplicateId', () => {
  it('turns a duplicate _id into SM-CORE-409-002 naming the resource', async () => {
    await Bow.create({
      _id: 'd1',
      userId: 'ana',
      version: 1,
      nickname: 'x',
      createdAt: at,
      updatedAt: at,
    } as never);
    const error = await Bow.create({
      _id: 'd1',
      userId: 'ana',
      version: 1,
      nickname: 'y',
      createdAt: at,
      updatedAt: at,
    } as never).catch((e: unknown) => e);
    expect(() => rethrowDuplicateId(error, 'bow')).toThrow(AppError);
    try {
      rethrowDuplicateId(error, 'bow');
    } catch (e) {
      expect(e).toMatchObject({ code: 'SM-CORE-409-002', params: { resource: 'bow' } });
    }
  });

  it('leaves every other error alone', () => {
    const other = new Error('network');
    expect(() => rethrowDuplicateId(other, 'bow')).toThrow(other);
    const businessIndex = { code: 11000, keyPattern: { userId: 1, bowId: 1 } };
    expect(() => rethrowDuplicateId(businessIndex, 'setup')).toThrow();
    try {
      rethrowDuplicateId(businessIndex, 'setup');
    } catch (e) {
      expect(e).toBe(businessIndex);
    }
  });
});
