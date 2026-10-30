// Indexes of every collection (docs/DICCIONARIO.md §4). `userId` leads every compound index so a
// query scoped to one archer never scans another's data. Uniqueness is partial on live documents
// (`deletedAt: null`), so a soft-deleted document does not block re-creating the same thing.

const alive = { deletedAt: { $type: 'null' } };
const NINETY_DAYS_S = 90 * 24 * 60 * 60;

/** @type {{ collection: string, key: Record<string, 1 | -1>, options: Record<string, unknown> }[]} */
const INDEXES = [
  ...['bows', 'sights', 'arrowSets'].map((collection) => ({
    collection,
    key: { userId: 1, status: 1, updatedAt: -1 },
    options: { name: 'user_status_updated' },
  })),
  {
    collection: 'setups',
    key: { userId: 1, isFavorite: -1, updatedAt: -1 },
    options: { name: 'user_favorite_updated' },
  },
  {
    collection: 'setups',
    key: { userId: 1, bowId: 1, sightId: 1 },
    options: { name: 'user_bow_sight_unique', unique: true, partialFilterExpression: alive },
  },
  {
    collection: 'setups',
    key: { userId: 1, arrowSetIds: 1 },
    options: { name: 'user_arrow_sets' },
  },
  { collection: 'setups', key: { userId: 1, sightId: 1 }, options: { name: 'user_sight' } },
  { collection: 'setups', key: { userId: 1, deletedAt: 1 }, options: { name: 'user_deleted' } },
  {
    collection: 'marks',
    key: { userId: 1, setupId: 1, arrowSetId: 1, distanceM: 1 },
    options: {
      name: 'user_setup_arrow_distance_unique',
      unique: true,
      partialFilterExpression: alive,
    },
  },
  { collection: 'marks', key: { userId: 1, arrowSetId: 1 }, options: { name: 'user_arrow_set' } },
  { collection: 'profiles', key: { userId: 1 }, options: { name: 'user_unique', unique: true } },
  {
    collection: 'idempotencyKeys',
    key: { userId: 1, key: 1 },
    options: { name: 'user_key_unique', unique: true },
  },
  {
    collection: 'idempotencyKeys',
    key: { expiresAt: 1 },
    options: { name: 'expires_ttl', expireAfterSeconds: 0 },
  },
  {
    collection: 'jobRuns',
    key: { startedAt: 1 },
    options: { name: 'started_ttl', expireAfterSeconds: NINETY_DAYS_S },
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
