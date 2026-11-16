// Indexes of the collections Better Auth owns (user, session, account, verification). It creates
// the documents; the lookups it makes on every request and the uniqueness it relies on live here.
// Same rule as the other migration: never edit an applied one, add a new file.

const hasUsername = { username: { $type: 'string' } };

/** @type {{ collection: string, key: Record<string, 1 | -1>, options: Record<string, unknown> }[]} */
const INDEXES = [
  { collection: 'user', key: { email: 1 }, options: { name: 'email_unique', unique: true } },
  {
    // Google users have no username: only registered ones must be unique.
    collection: 'user',
    key: { username: 1 },
    options: { name: 'username_unique', unique: true, partialFilterExpression: hasUsername },
  },
  { collection: 'session', key: { token: 1 }, options: { name: 'token_unique', unique: true } },
  { collection: 'session', key: { userId: 1 }, options: { name: 'user' } },
  {
    collection: 'session',
    key: { expiresAt: 1 },
    options: { name: 'expires_ttl', expireAfterSeconds: 0 },
  },
  { collection: 'account', key: { userId: 1 }, options: { name: 'user' } },
  {
    collection: 'account',
    key: { providerId: 1, accountId: 1 },
    options: { name: 'provider_account' },
  },
  { collection: 'verification', key: { identifier: 1 }, options: { name: 'identifier' } },
  {
    collection: 'verification',
    key: { expiresAt: 1 },
    options: { name: 'expires_ttl', expireAfterSeconds: 0 },
  },
];

/** @param {import('mongodb').Db} db */
export async function up(db) {
  for (const { collection, key, options } of INDEXES) {
    await db.collection(collection).createIndex(key, options);
  }
}

/** @param {import('mongodb').Db} db */
export async function down(db) {
  for (const { collection, options } of INDEXES) {
    await db.collection(collection).dropIndex(String(options.name));
  }
}
