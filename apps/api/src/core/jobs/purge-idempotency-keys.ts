import { toDate } from '../db/temporal.js';
import type { Job } from './scheduler.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Deletes idempotency keys past their 24 h (SPEC §12). The TTL index already does it, about once a
 * minute and without a trace; this job is the same cleanup done on purpose, so it shows up in
 * `jobRuns` and still works where the TTL monitor is off. It touches every archer's keys, which is
 * the reason it uses the driver and not an isolated model: it is the one maintenance task allowed
 * to cross users, and it reads nothing from them.
 */
export const purgeIdempotencyKeys: Job = {
  name: 'purgeIdempotencyKeys',
  intervalMs: HOUR_MS,
  async run({ now, connection }) {
    const handle = connection.db;
    if (handle === undefined) throw new Error('purgeIdempotencyKeys needs a connected database');
    const result = await handle
      .collection('idempotencyKeys')
      .deleteMany({ expiresAt: { $lt: toDate(now) } });
    return { deleted: result.deletedCount };
  },
};
