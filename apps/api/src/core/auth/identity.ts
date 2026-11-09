import { ObjectId } from 'mongodb';
import type { DbConnection } from '../db/connection.js';

/**
 * Removes who the archer is: the user, their sessions and their linked accounts (Google, password),
 * and the pending verification links. Better Auth keeps these in its own collections; the id may be
 * stored as a string or as an ObjectId depending on the field, so both are matched. Idempotent.
 */
export async function deleteIdentity(connection: DbConnection, userId: string): Promise<void> {
  const handle = connection.db;
  if (handle === undefined) throw new Error('purge needs a connected database');
  const ids: (string | ObjectId)[] = [userId];
  if (ObjectId.isValid(userId) && userId.length === 24) ids.push(new ObjectId(userId));

  const users = handle.collection('user');
  const user = await users.findOne({ _id: { $in: ids as never[] } }, { projection: { email: 1 } });
  await handle.collection('session').deleteMany({ userId: { $in: ids } });
  await handle.collection('account').deleteMany({ userId: { $in: ids } });
  if (user !== null && typeof user['email'] === 'string') {
    await handle.collection('verification').deleteMany({ identifier: user['email'] });
  }
  await users.deleteMany({ _id: { $in: ids as never[] } });
}
