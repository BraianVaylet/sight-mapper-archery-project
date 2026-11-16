import { Temporal } from '@js-temporal/polyfill';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../src/core/clock/clock.js';
import { connectMongo } from '../src/core/db/connection.js';
import { toDate } from '../src/core/db/temporal.js';
import type { IdempotencyRecord } from '../src/core/idempotency/idempotency.js';
import { createMongoIdempotencyStore } from '../src/core/idempotency/mongo-store.js';
import { purgeIdempotencyKeys } from '../src/core/jobs/purge-idempotency-keys.js';
import { createScheduler, type Job } from '../src/core/jobs/scheduler.js';
import { createLogger } from '../src/core/logger/logger.js';
import { startReplSet } from './helpers/mongo.js';

const START = Temporal.Instant.from('2026-11-01T12:00:00Z');
let now = START;
const clock: Clock = { now: () => now };
const advance = (ms: number) => void (now = now.add({ milliseconds: ms }));

let replSet: MongoMemoryReplSet;
let connection: Connection;
const logger = createLogger({ level: 'silent' });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  replSet = await startReplSet();
  connection = await connectMongo(replSet.getUri('sightmapper_jobs'), logger);
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

beforeEach(async () => {
  now = START;
  await connection.db?.collection('jobLocks').deleteMany({});
  await connection.db?.collection('jobRuns').deleteMany({});
});

const scheduler = (jobs: Job[], owner: string, tickMs?: number) =>
  createScheduler({ connection, clock, logger, jobs, owner, ...(tickMs ? { tickMs } : {}) });

/** A job that counts its runs and takes a moment, so concurrent instances really overlap. */
function counting(name = 'count', intervalMs = 60_000) {
  const state = { runs: 0 };
  const job: Job = {
    name,
    intervalMs,
    async run() {
      state.runs += 1;
      await pause(30);
      return { processed: state.runs };
    },
  };
  return { state, job };
}

const runsOf = (job: string) =>
  connection.db?.collection('jobRuns').find({ job }).toArray() ?? Promise.resolve([]);

describe('one run per window across instances', () => {
  it('two instances ticking at once run the job a single time', async () => {
    const { state, job } = counting();
    const [a, b] = [scheduler([job], 'A'), scheduler([job], 'B')];
    const [ranA, ranB] = await Promise.all([a.runDue(), b.runDue()]);

    expect(state.runs).toBe(1);
    expect(ranA.length + ranB.length).toBe(1);
    expect(await runsOf('count')).toHaveLength(1);
  });

  it('five instances racing still run it once', async () => {
    const { state, job } = counting();
    const instances = ['A', 'B', 'C', 'D', 'E'].map((owner) => scheduler([job], owner));
    await Promise.all(instances.map((s) => s.runDue()));
    expect(state.runs).toBe(1);
  });

  it('does not run again inside the window, not even on a later tick', async () => {
    const { state, job } = counting();
    const [a, b] = [scheduler([job], 'A'), scheduler([job], 'B')];
    await a.runDue();
    advance(30_000);
    await Promise.all([a.runDue(), b.runDue()]);
    expect(state.runs).toBe(1);
  });

  it('a job that finishes early is not taken again by a slower neighbour in the same window', async () => {
    const { state, job } = counting();
    await scheduler([job], 'A').runDue();
    await scheduler([job], 'B').runDue();
    expect(state.runs).toBe(1);
  });

  it('runs again, once, when the next window opens', async () => {
    const { state, job } = counting();
    const [a, b] = [scheduler([job], 'A'), scheduler([job], 'B')];
    await Promise.all([a.runDue(), b.runDue()]);
    advance(60_000);
    await Promise.all([a.runDue(), b.runDue()]);
    expect(state.runs).toBe(2);
    expect(await runsOf('count')).toHaveLength(2);
  });

  it('gives each job its own lock', async () => {
    const one = counting('one');
    const two = counting('two');
    await scheduler([one.job, two.job], 'A').runDue();
    expect([one.state.runs, two.state.runs]).toEqual([1, 1]);
  });

  it('a window opens exactly when the lock expires', async () => {
    const { state, job } = counting();
    const s = scheduler([job], 'A');
    await s.runDue();
    advance(59_999);
    await s.runDue();
    expect(state.runs).toBe(1);
    advance(1);
    await s.runDue();
    expect(state.runs).toBe(2);
  });

  it('records who holds the lock and until when', async () => {
    const { job } = counting();
    await scheduler([job], 'A').runDue();
    const lock = await connection.db?.collection('jobLocks').findOne({ _id: 'count' as never });
    expect(lock).toMatchObject({
      owner: 'A',
      lockedUntil: toDate(START.add({ milliseconds: 60_000 })),
    });
  });
});

describe('jobRuns', () => {
  it('records every run: job, times, duration, status and counts', async () => {
    const { job } = counting();
    const [run] = await scheduler([job], 'A').runDue();
    expect(run).toMatchObject({ job: 'count', status: 'ok', stats: { processed: 1 } });

    const [doc] = await runsOf('count');
    expect(doc).toMatchObject({ job: 'count', status: 'ok', stats: { processed: 1 } });
    expect(doc?.['startedAt']).toEqual(toDate(START));
    expect(typeof doc?.['durationMs']).toBe('number');
    expect(doc).not.toHaveProperty('error');
  });

  it('records a failure with its message, keeps going, and does not retry inside the window', async () => {
    let attempts = 0;
    const failing: Job = {
      name: 'failing',
      intervalMs: 60_000,
      run() {
        attempts += 1;
        return Promise.reject(new Error('boom'));
      },
    };
    const healthy = counting('healthy');
    const s = scheduler([failing, healthy.job], 'A');

    const runs = await s.runDue();
    expect(runs.map((r) => [r.job, r.status])).toEqual([
      ['failing', 'failed'],
      ['healthy', 'ok'],
    ]);
    const [doc] = await runsOf('failing');
    expect(doc).toMatchObject({ status: 'failed', error: 'boom', stats: {} });
    expect(JSON.stringify(doc)).not.toContain('at ');

    advance(10_000);
    await s.runDue();
    expect(attempts).toBe(1);
  });

  it('also records a failure that is not an Error', async () => {
    const job: Job = { name: 'odd', intervalMs: 1000, run: () => Promise.reject('plain string') };
    await scheduler([job], 'A').runDue();
    expect((await runsOf('odd'))[0]).toMatchObject({ status: 'failed', error: 'plain string' });
  });
});

describe('start and stop', () => {
  it('ticks on its own after start() and stops after stop()', async () => {
    const { state, job } = counting('ticking', 1);
    const s = scheduler([job], 'A', 20);
    s.start();
    s.start(); // a second start is a no-op, not a second timer
    for (let i = 0; i < 100 && state.runs === 0; i++) await pause(20);
    s.stop();
    expect(state.runs).toBeGreaterThanOrEqual(1);

    const stoppedAt = state.runs;
    advance(10_000);
    await pause(150);
    expect(state.runs).toBe(stoppedAt);
    s.stop(); // stopping twice is harmless
  });
});

describe('purgeIdempotencyKeys', () => {
  const store = () => createMongoIdempotencyStore(connection, clock);
  const record = (key: string, expiresAt: Temporal.Instant, userId = 'ana'): IdempotencyRecord => ({
    userId,
    key,
    method: 'POST',
    path: '/api/v1/bows',
    requestHash: 'a'.repeat(64),
    statusCode: 201,
    responseBody: '{}',
    responseHeaders: {},
    createdAt: START.subtract({ hours: 30 }),
    expiresAt,
  });

  beforeEach(async () => {
    await connection.db?.collection('idempotencyKeys').deleteMany({});
  });

  it('deletes expired keys of every archer and keeps the live ones', async () => {
    const s = store();
    await s.save(record('expired-key-0001', START.subtract({ hours: 1 })));
    await s.save(record('expired-key-0002', START.subtract({ minutes: 1 }), 'beto'));
    await s.save(record('live-key-000001', START.add({ hours: 5 })));
    await s.save(record('live-key-000002', START.add({ seconds: 1 }), 'beto'));

    const [run] = await scheduler([purgeIdempotencyKeys], 'A').runDue();
    expect(run).toMatchObject({ job: 'purgeIdempotencyKeys', status: 'ok', stats: { deleted: 2 } });

    const left = await connection.db?.collection('idempotencyKeys').find({}).toArray();
    expect(left?.map((d) => d['key']).sort()).toEqual(['live-key-000001', 'live-key-000002']);
  });

  it('is idempotent: running it again deletes nothing and does not fail', async () => {
    await store().save(record('expired-key-0003', START.subtract({ hours: 2 })));
    expect((await scheduler([purgeIdempotencyKeys], 'A').runDue())[0]?.stats).toEqual({
      deleted: 1,
    });
    advance(60 * 60 * 1000);
    expect((await scheduler([purgeIdempotencyKeys], 'A').runDue())[0]?.stats).toEqual({
      deleted: 0,
    });
  });

  it('keeps a key whose expiry is exactly now', async () => {
    await store().save(record('edge-key-000001', START));
    await scheduler([purgeIdempotencyKeys], 'A').runDue();
    expect(await connection.db?.collection('idempotencyKeys').countDocuments({})).toBe(1);
  });

  it('runs once an hour across instances', () => {
    expect(purgeIdempotencyKeys.intervalMs).toBe(3_600_000);
    expect(purgeIdempotencyKeys.name).toBe('purgeIdempotencyKeys');
  });
});
