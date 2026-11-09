import { TRASH_DAYS } from '@sight-mapper/schemas';
import { toDate } from '../../../core/db/temporal.js';
import type { Job } from '../../../core/jobs/scheduler.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Empties the trash for good (SPEC §12): setups and marks deleted more than 30 days ago go. It crosses archers by design, so it uses the driver
 * and not an isolated model, and it reads nothing from the documents it removes. Running it
 * again deletes nothing more: it is idempotent.
 */
export const purgeDeletedSetups: Job = {
  name: 'purgeDeletedSetups',
  intervalMs: DAY_MS,
  async run({ now, connection }) {
    const handle = connection.db;
    if (handle === undefined) throw new Error('purgeDeletedSetups needs a connected database');
    const cutoff = toDate(now.subtract({ hours: TRASH_DAYS * 24 }));
    const expired = { deletedAt: { $lt: cutoff } };
    // Marks first: a mark deleted by itself more than 30 days ago goes too, with or without its setup.
    const marks = await handle.collection('marks').deleteMany(expired);
    const setups = await handle.collection('setups').deleteMany(expired);
    return { deleted: setups.deletedCount, marksDeleted: marks.deletedCount };
  },
};
