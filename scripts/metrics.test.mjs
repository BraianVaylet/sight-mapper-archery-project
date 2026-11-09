import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMetrics } from './metrics.mjs';

const NOW = new Date('2026-12-01T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const after = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const profile = (userId, signedUp) => ({ userId, createdAt: signedUp });
const setup = (id, userId, at, deletedAt = null) => ({ id, userId, createdAt: at, deletedAt });
const mark = (userId, setupId, at, extra = {}) => ({
  userId,
  setupId,
  arrowSetId: 'a1',
  origin: 'measured',
  version: 1,
  createdAt: at,
  deletedAt: null,
  ...extra,
});

describe('the MVP metrics (spec §2)', () => {
  it('counts as activated an archer with a setup and 2 marks within 7 days of signing up', () => {
    const signed = daysAgo(20);
    const m = computeMetrics({
      profiles: [profile('u1', signed), profile('u2', signed)],
      setups: [setup('s1', 'u1', after(signed, 1)), setup('s2', 'u2', after(signed, 1))],
      marks: [
        mark('u1', 's1', after(signed, 2)),
        mark('u1', 's1', after(signed, 3)),
        // u2 gets the second mark on day 9: too late for the metric.
        mark('u2', 's2', after(signed, 2)),
        mark('u2', 's2', after(signed, 9)),
      ],
      now: NOW,
    });
    assert.deepEqual(m.activation, { cohort: 2, activated: 1, ratePct: 50, targetPct: 50 });
  });

  it('leaves out of the cohort an archer who has not had their 7 days yet', () => {
    const m = computeMetrics({
      profiles: [profile('new', daysAgo(3))],
      setups: [],
      marks: [],
      now: NOW,
    });
    assert.equal(m.activation.cohort, 0);
    assert.equal(m.activation.ratePct, null);
  });

  it('can look at one cohort only (--since)', () => {
    const m = computeMetrics({
      profiles: [profile('old', daysAgo(60)), profile('recent', daysAgo(10))],
      setups: [],
      marks: [],
      now: NOW,
      since: daysAgo(30),
    });
    assert.equal(m.activation.cohort, 1);
  });

  it('counts the live setups that reach 5 live measured marks on some arrow set', () => {
    const at = daysAgo(10);
    const five = [20, 30, 40, 50, 60].map(() => mark('u1', 's1', at));
    const m = computeMetrics({
      profiles: [],
      setups: [setup('s1', 'u1', at), setup('s2', 'u1', at), setup('s3', 'u1', at, daysAgo(1))],
      marks: [
        ...five,
        // s2 has 5 marks, but one was deleted: 4 live.
        ...[1, 2, 3, 4].map(() => mark('u1', 's2', at)),
        mark('u1', 's2', at, { deletedAt: daysAgo(2) }),
      ],
      now: NOW,
    });
    assert.deepEqual(m.doctorReach, { setups: 2, withFiveMarks: 1, ratePct: 50, targetPct: 30 });
  });

  it('counts a live mark changed after it was saved as re-measured; seeded ones do not count', () => {
    const at = daysAgo(5);
    const m = computeMetrics({
      profiles: [],
      setups: [],
      marks: [
        mark('u1', 's1', at, { version: 2 }),
        mark('u1', 's1', at),
        mark('u1', 's1', at),
        mark('u1', 's1', at, { origin: 'seeded', version: 3 }),
      ],
      now: NOW,
    });
    assert.deepEqual(m.remeasured, { marks: 3, corrected: 1, ratePct: 33.3 });
  });

  it('carries no ids, emails or readings: only counts and rates', () => {
    const at = daysAgo(10);
    const m = computeMetrics({
      profiles: [profile('secret-user', at)],
      setups: [setup('secret-setup', 'secret-user', at)],
      marks: [mark('secret-user', 'secret-setup', at, { scaleValueMm: 16 })],
      now: NOW,
    });
    const text = JSON.stringify(m);
    assert.ok(!text.includes('secret'));
    assert.ok(!text.includes('scaleValueMm'));
  });
});

describe('reading the rows from a real database', () => {
  it('reads only what the metrics need and gives the same numbers', async () => {
    const { createRequire } = await import('node:module');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { readRows } = await import('./metrics.mjs');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const require = createRequire(join(root, 'apps', 'api', 'package.json'));
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const { MongoClient } = require('mongodb');
    const server = await MongoMemoryServer.create({
      binary: { version: process.env.MONGOMS_VERSION ?? '7.0.24' },
    });
    const uri = server.getUri('metrics');
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const db = client.db();
      const signed = daysAgo(20);
      await db
        .collection('profiles')
        .insertOne({ _id: 'p1', userId: 'u1', createdAt: signed, theme: 'dark' });
      await db.collection('setups').insertOne({
        _id: 's1',
        userId: 'u1',
        createdAt: after(signed, 1),
        deletedAt: null,
        name: 'private',
      });
      await db.collection('marks').insertMany(
        [20, 30, 40, 50, 60].map((d, i) => ({
          _id: `m${i}`,
          userId: 'u1',
          setupId: 's1',
          arrowSetId: 'a1',
          origin: 'measured',
          version: 1,
          distanceM: d,
          scaleValueMm: i,
          note: 'private',
          createdAt: after(signed, 2),
          deletedAt: null,
        })),
      );
      const rows = await readRows(uri);
      assert.ok(
        !JSON.stringify(rows).includes('private'),
        'reads names and notes it does not need',
      );
      const m = computeMetrics({ ...rows, now: NOW });
      assert.equal(m.activation.activated, 1);
      assert.equal(m.doctorReach.withFiveMarks, 1);
    } finally {
      await client.close();
      await server.stop();
    }
  });
});
