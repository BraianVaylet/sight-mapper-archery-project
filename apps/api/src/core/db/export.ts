import type { DbConnection } from './connection.js';

/** A stored document as it goes on the wire: `id`, ISO instants, no user id and no driver bookkeeping. */
function toWire(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toWire);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'userId' && key !== '__v')
        .map(([key, inner]) => [key === '_id' ? 'id' : key, toWire(inner)]),
    );
  }
  return value;
}

/**
 * Every document of one archer in a collection, **including the archived and the ones in the trash**
 * (HU-ACC-05: all that is stored). It reads through the driver because the isolated models hide what
 * is soft-deleted, so the `userId` filter is written here and nowhere else.
 */
export async function readAllOf(
  connection: DbConnection,
  collection: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const handle = connection.db;
  if (handle === undefined) throw new Error('export needs a connected database');
  const rows = await handle.collection(collection).find({ userId }).sort({ _id: 1 }).toArray();
  return rows.map((row) => toWire(row) as Record<string, unknown>);
}

/** Removes every document of one archer from a collection, for good (the purge of an account). */
export async function deleteAllOf(
  connection: DbConnection,
  collection: string,
  userId: string,
): Promise<number> {
  const handle = connection.db;
  if (handle === undefined) throw new Error('purge needs a connected database');
  const result = await handle.collection(collection).deleteMany({ userId });
  return result.deletedCount;
}
