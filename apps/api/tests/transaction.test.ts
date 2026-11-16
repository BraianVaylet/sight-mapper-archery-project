import { Temporal } from '@js-temporal/polyfill';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection, Model } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBusinessSchema } from '../src/core/db/base-schema.js';
import { connectMongo } from '../src/core/db/connection.js';
import { toDate } from '../src/core/db/temporal.js';
import { createTransact } from '../src/core/db/transaction.js';
import { createLogger } from '../src/core/logger/logger.js';
import { startReplSet } from './helpers/mongo.js';

let replSet: MongoMemoryReplSet;
let connection: Connection;
let Things: Model<{ _id: string; userId: string; version: number }>;

beforeAll(async () => {
  replSet = await startReplSet();
  connection = await connectMongo(
    replSet.getUri('sightmapper_transaction'),
    createLogger({ level: 'silent' }),
  );
  Things = connection.model('Tx', createBusinessSchema({}, { collection: 'txThings' })) as never;
  await Things.createCollection();
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

const stamp = toDate(Temporal.Instant.fromEpochMilliseconds(0));
const make = (id: string) =>
  Things.create({ _id: id, userId: 'u', version: 1, createdAt: stamp, updatedAt: stamp } as never);
const count = (prefix: string) =>
  Things.countDocuments({ userId: 'u', _id: { $regex: `^${prefix}` } });

describe('createTransact', () => {
  const transact = () => createTransact(connection);

  it('commits everything the work wrote through the models, with no session handed around', async () => {
    await transact()(async () => {
      await make('ok-1');
      await make('ok-2');
    });
    expect(await count('ok-')).toBe(2);
  });

  it('rolls back all of it when the work throws, and rethrows', async () => {
    await expect(
      transact()(async () => {
        await make('boom-1');
        await make('boom-2');
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect(await count('boom-')).toBe(0);
  });

  it('returns what the work returns', async () => {
    expect(await transact()(() => Promise.resolve(42))).toBe(42);
  });
});
