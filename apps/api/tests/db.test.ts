import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import { config, database, down, status, up } from 'migrate-mongo';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection, Model } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBusinessSchema } from '../src/core/db/base-schema.js';
import { connectMongo, mongoReadiness, withTransaction } from '../src/core/db/connection.js';
import { fromDate, toDate } from '../src/core/db/temporal.js';
import { AppError } from '../src/core/http/errors.js';
import { createLogger } from '../src/core/logger/logger.js';
import { startReplSet } from './helpers/mongo.js';

const NOW = toDate(Temporal.Instant.from('2026-10-30T12:00:00Z'));
const silent = createLogger({ level: 'silent' });

let replSet: MongoMemoryReplSet;
let uri: string;
let connection: Connection;
let Thing: Model<Record<string, unknown>>;

const thing = (id: string, userId: string, extra: Record<string, unknown> = {}) => ({
  _id: id,
  userId,
  createdAt: NOW,
  updatedAt: NOW,
  name: 'x',
  ...extra,
});

beforeAll(async () => {
  replSet = await startReplSet();
  uri = replSet.getUri('sightmapper_test');
  connection = await connectMongo(uri, silent);
  Thing = connection.model('Thing', createBusinessSchema({ name: String, status: String }));
  await Thing.init();
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

const expectIsolationViolation = async (action: () => unknown) => {
  const error = await Promise.resolve()
    .then(action)
    .then(
      () => undefined,
      (e: unknown) => e,
    );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe('SM-CORE-500-002');
};

describe('isolation plugin (ADR-000)', () => {
  it('refuses every query that is not scoped by userId with SM-CORE-500-002', async () => {
    await expectIsolationViolation(() => Thing.find({}));
    await expectIsolationViolation(() => Thing.findOne({ name: 'x' }));
    await expectIsolationViolation(() => Thing.countDocuments({}));
    await expectIsolationViolation(() => Thing.updateOne({ _id: 'a' }, { name: 'y' }));
    await expectIsolationViolation(() => Thing.updateMany({}, { name: 'y' }));
    await expectIsolationViolation(() => Thing.deleteOne({ _id: 'a' }));
    await expectIsolationViolation(() => Thing.deleteMany({}));
    await expectIsolationViolation(() => Thing.findOneAndUpdate({ _id: 'a' }, { name: 'y' }));
    await expectIsolationViolation(() => Thing.findOneAndDelete({ _id: 'a' }));
    await expectIsolationViolation(() => Thing.distinct('name', {}));
    await expectIsolationViolation(() => Thing.estimatedDocumentCount());
  });

  it('refuses a userId that is undefined or null: it would match everything', async () => {
    await expectIsolationViolation(() => Thing.find({ userId: undefined }));
    await expectIsolationViolation(() => Thing.find({ userId: null }));
  });

  it('refuses writes and aggregations without userId', async () => {
    await expectIsolationViolation(() =>
      new Thing({ _id: 'n1', createdAt: NOW, updatedAt: NOW }).save(),
    );
    await expectIsolationViolation(() =>
      Thing.insertMany([{ _id: 'n2', createdAt: NOW, updatedAt: NOW }]),
    );
    await expectIsolationViolation(() => Thing.aggregate([{ $group: { _id: '$name' } }]));
    await expectIsolationViolation(() => Thing.aggregate([{ $match: { name: 'x' } }]));
    await expectIsolationViolation(() => Thing.aggregate([]));
  });

  it('lets a scoped query through and never returns another user’s documents', async () => {
    await Thing.insertMany([thing('i1', 'ana'), thing('i2', 'ana'), thing('i3', 'beto')]);
    const mine = await Thing.find({ userId: 'ana' }).lean();
    expect(mine.map((d) => d['_id']).sort()).toEqual(['i1', 'i2']);
    expect(await Thing.countDocuments({ userId: 'beto' })).toBe(1);
    expect(await Thing.findOne({ userId: 'ana', _id: 'i3' })).toBeNull();
    const grouped = await Thing.aggregate([{ $match: { userId: 'beto' } }, { $count: 'n' }]);
    expect(grouped).toEqual([{ n: 1 }]);
    expect(
      (await Thing.updateOne({ userId: 'ana', _id: 'i3' }, { name: 'hack' })).matchedCount,
    ).toBe(0);
  });
});

describe('soft delete plugin', () => {
  it('stores an explicit null while alive and hides deleted documents', async () => {
    await Thing.create(thing('s1', 'sd'));
    await Thing.create(thing('s2', 'sd', { deletedAt: NOW }));
    const raw = await connection.db?.collection('things').findOne({ _id: 's1' as never });
    expect(raw).toHaveProperty('deletedAt', null);

    expect((await Thing.find({ userId: 'sd' }).lean()).map((d) => d['_id'])).toEqual(['s1']);
    expect(await Thing.countDocuments({ userId: 'sd' })).toBe(1);
    expect(await Thing.findOne({ userId: 'sd', _id: 's2' })).toBeNull();
    expect((await Thing.updateOne({ userId: 'sd', _id: 's2' }, { name: 'z' })).matchedCount).toBe(
      0,
    );
  });

  it('shows deleted documents only when the query opts in', async () => {
    const all = await Thing.find({ userId: 'sd' }, null, { withDeleted: true }).lean();
    expect(all.map((d) => d['_id']).sort()).toEqual(['s1', 's2']);
    const trash = await Thing.find({ userId: 'sd', deletedAt: { $ne: null } }, null, {
      withDeleted: true,
    }).lean();
    expect(trash.map((d) => d['_id'])).toEqual(['s2']);
  });
});

describe('transactions', () => {
  it('commits every write together', async () => {
    await withTransaction(connection, async (session) => {
      await Thing.create([thing('t1', 'tx'), thing('t2', 'tx')], { session, ordered: true });
    });
    expect(await Thing.countDocuments({ userId: 'tx' })).toBe(2);
  });

  it('rolls everything back when the work throws, and rethrows', async () => {
    await expect(
      withTransaction(connection, async (session) => {
        await Thing.create([thing('r1', 'rb')], { session });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await Thing.countDocuments({ userId: 'rb' })).toBe(0);
  });
});

describe('readiness', () => {
  it('passes while Mongo answers', async () => {
    await expect(mongoReadiness(connection).check()).resolves.toBeUndefined();
  });

  it('fails when there is no database handle', async () => {
    const detached = { db: undefined } as unknown as Connection;
    await expect(mongoReadiness(detached).check()).rejects.toThrow('not connected');
  });

  it('fails when the ping takes longer than the timeout', async () => {
    const slow = {
      db: { admin: () => ({ ping: () => new Promise(() => undefined) }) },
    } as unknown as Connection;
    await expect(mongoReadiness(slow, 20).check()).rejects.toThrow('timed out');
  });
});

describe('Temporal <-> Date translator', () => {
  it('round-trips an instant exactly to the millisecond', () => {
    const instant = Temporal.Instant.from('2026-10-30T12:34:56.789Z');
    expect(toDate(instant).toISOString()).toBe('2026-10-30T12:34:56.789Z');
    expect(fromDate(toDate(instant)).toString()).toBe('2026-10-30T12:34:56.789Z');
  });
});

describe('migrations', () => {
  const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));
  let migrationUri: string;

  const run = async <T>(
    work: (api: Awaited<ReturnType<typeof database.connect>>) => Promise<T>,
  ) => {
    config.set({
      mongodb: { url: migrationUri, options: {} },
      migrationsDir,
      changelogCollectionName: 'changelog',
      migrationFileExtension: '.js',
      moduleSystem: 'esm',
    });
    const api = await database.connect();
    try {
      return await work(api);
    } finally {
      await api.client.close();
    }
  };

  beforeAll(() => {
    migrationUri = replSet.getUri('sightmapper_migrations');
  });

  it('applies the indexes once and does nothing the second time', async () => {
    const first = await run(({ db, client }) => up(db, client));
    expect(first).toEqual(['20261030000000-initial-indexes.js']);
    const second = await run(({ db, client }) => up(db, client));
    expect(second).toEqual([]);
    const applied = await run(({ db }) => status(db));
    expect(applied.filter((m) => m.appliedAt !== 'PENDING')).toHaveLength(1);
  });

  it('creates the indexes of the data dictionary', async () => {
    const names = async (collection: string) =>
      (await run(({ db }) => db.collection(collection).indexes())).map((i) => i.name);
    expect(await names('bows')).toContain('user_status_updated');
    expect(await names('sights')).toContain('user_status_updated');
    expect(await names('arrowSets')).toContain('user_status_updated');
    expect(await names('setups')).toEqual(
      expect.arrayContaining([
        'user_favorite_updated',
        'user_bow_sight_unique',
        'user_arrow_sets',
        'user_sight',
        'user_deleted',
      ]),
    );
    expect(await names('marks')).toEqual(
      expect.arrayContaining(['user_setup_arrow_distance_unique', 'user_arrow_set']),
    );
    expect(await names('profiles')).toContain('user_unique');
    expect(await names('idempotencyKeys')).toEqual(
      expect.arrayContaining(['user_key_unique', 'expires_ttl']),
    );
    expect(await names('jobRuns')).toContain('started_ttl');
  });

  it('lets a deleted mark and an active one share a distance, but not two active ones', async () => {
    const key = { userId: 'u1', setupId: 's1', arrowSetId: 'a1', distanceM: 40 };
    const mark = (id: string, deletedAt: Date | null) => ({
      _id: id as never,
      ...key,
      scaleValueMm: 35,
      deletedAt,
    });
    await run(async ({ db }) => {
      const marks = db.collection('marks');
      await marks.insertOne(mark('m1', NOW)); // soft deleted
      await marks.insertOne(mark('m2', null)); // active: allowed next to the deleted one
      await marks.insertOne(mark('m3', NOW)); // a second deleted one is fine too
      await expect(marks.insertOne(mark('m4', null))).rejects.toMatchObject({ code: 11000 });
      await marks.insertOne({ ...mark('m5', null), distanceM: 41 }); // another distance
    });
  });

  it('keeps a bow-sight pair unique among live setups only', async () => {
    const setup = (id: string, deletedAt: Date | null) => ({
      _id: id as never,
      userId: 'u1',
      bowId: 'b1',
      sightId: 'sg1',
      deletedAt,
    });
    await run(async ({ db }) => {
      const setups = db.collection('setups');
      await setups.insertOne(setup('p1', NOW));
      await setups.insertOne(setup('p2', null));
      await expect(setups.insertOne(setup('p3', null))).rejects.toMatchObject({ code: 11000 });
    });
  });

  it('reverts cleanly', async () => {
    const reverted = await run(({ db, client }) => down(db, client));
    expect(reverted).toEqual(['20261030000000-initial-indexes.js']);
    const names = (await run(({ db }) => db.collection('marks').indexes())).map((i) => i.name);
    expect(names).toEqual(['_id_']);
  });
});
