import { DELETION_DAYS } from '@sight-mapper/schemas';
import { toDate } from '../../../core/db/temporal.js';
import { deleteAllOf } from '../../../core/db/export.js';
import type { DbConnection } from '../../../core/db/connection.js';
import type { EventBus } from '../../../core/events/bus.js';
import type { Job } from '../../../core/jobs/scheduler.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Carries out the deletions that were asked for `DELETION_DAYS` ago or more (RF-ACC-06). It crosses
 * archers by design, so it reads the profiles through the driver and reads nothing else from them: for
 * each one it publishes `AccountPurged`, and the modules (equipment, calculator, the identity) remove
 * what is theirs. The profile goes last: if anything fails halfway, the profile is still there and
 * the next run finishes the job. Idempotent.
 */
export function createPurgeDeletedAccounts(deps: { readonly bus: Pick<EventBus, 'publish'> }): Job {
  return {
    name: 'purgeDeletedAccounts',
    intervalMs: DAY_MS,
    async run({ now, connection }) {
      const handle = connection.db;
      if (handle === undefined) throw new Error('purgeDeletedAccounts needs a connected database');
      const cutoff = toDate(now.subtract({ hours: DELETION_DAYS * 24 }));
      const due = await handle
        .collection('profiles')
        .find({ deletionRequestedAt: { $ne: null, $lte: cutoff } }, { projection: { userId: 1 } })
        .toArray();
      let purged = 0;
      for (const { userId } of due) {
        await deps.bus.publish('AccountPurged', { userId: String(userId) });
        purged += 1;
      }
      return { purged };
    },
  };
}

/** `AccountPurged`: the account removes its own profile, after every other module has finished. */
export function createPurgeProfile(connection: DbConnection) {
  return async (userId: string) => {
    await deleteAllOf(connection, 'profiles', userId);
  };
}
