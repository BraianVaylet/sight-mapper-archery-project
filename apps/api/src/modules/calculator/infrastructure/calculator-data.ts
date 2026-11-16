import type { DbConnection } from '../../../core/db/connection.js';
import { deleteAllOf, readAllOf } from '../../../core/db/export.js';

/** What the calculator contributes to an archer's export (HU-ACC-05): setups and marks, trash included. */
export function createCalculatorExport(connection: DbConnection) {
  return async (userId: string) => ({
    setups: await readAllOf(connection, 'setups', userId),
    marks: await readAllOf(connection, 'marks', userId),
  });
}

/** `AccountPurged`: the calculator removes every mark and setup of the archer. Idempotent. */
export function createPurgeCalculatorData(connection: DbConnection) {
  return async (userId: string) => {
    await deleteAllOf(connection, 'marks', userId);
    await deleteAllOf(connection, 'setups', userId);
  };
}
