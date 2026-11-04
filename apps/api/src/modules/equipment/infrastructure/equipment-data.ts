import type { DbConnection } from '../../../core/db/connection.js';
import { deleteAllOf, readAllOf } from '../../../core/db/export.js';

/** What equipment contributes to an archer's export (HU-ACC-05): all of their components. */
export function createEquipmentExport(connection: DbConnection) {
  return async (userId: string) => ({
    bows: await readAllOf(connection, 'bows', userId),
    sights: await readAllOf(connection, 'sights', userId),
    arrowSets: await readAllOf(connection, 'arrowSets', userId),
  });
}

/** `AccountPurged`: equipment removes everything of the archer, for good. Idempotent. */
export function createPurgeEquipment(connection: DbConnection) {
  return async (userId: string) => {
    await deleteAllOf(connection, 'bows', userId);
    await deleteAllOf(connection, 'sights', userId);
    await deleteAllOf(connection, 'arrowSets', userId);
  };
}
