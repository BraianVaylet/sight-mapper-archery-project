import { Schema, type Model } from 'mongoose';
import { createBusinessSchema } from '../../../core/db/base-schema.js';
import type { DbConnection } from '../../../core/db/connection.js';
import { fromDate, toDate } from '../../../core/db/temporal.js';
import { updateWithVersion } from '../../../core/db/versioned.js';
import type { PreferencesPatch, Profile, ProfileRepositories } from '../domain/profile.js';

const MONGO_DUPLICATE_KEY = 11000;

const schema = createBusinessSchema(
  {
    locale: { type: String, required: true },
    unitSystem: { type: String, required: true },
    theme: { type: String, required: true },
    quickAccess: { type: Schema.Types.Mixed, default: null },
    deletionRequestedAt: { type: Date, default: null },
  },
  { collection: 'profiles' },
);

type Row = {
  _id: string;
  userId: string;
  locale: Profile['locale'];
  unitSystem: Profile['unitSystem'];
  theme: Profile['theme'];
  quickAccess: Profile['quickAccess'];
  deletionRequestedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const toProfile = (row: Row): Profile => ({
  id: row._id,
  userId: row.userId,
  locale: row.locale,
  unitSystem: row.unitSystem,
  theme: row.theme,
  quickAccess: row.quickAccess ?? null,
  deletionRequestedAt: row.deletionRequestedAt === null ? null : fromDate(row.deletionRequestedAt),
  version: row.version,
  createdAt: fromDate(row.createdAt),
  updatedAt: fromDate(row.updatedAt),
});

/** `{ theme: undefined }` must not become a write: Mongo would store a null. */
const definedOnly = (patch: PreferencesPatch): Record<string, string> =>
  Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Record<
    string,
    string
  >;

/** Every query carries the user id fixed here; the isolation plugin refuses one that does not. */
export function createProfileRepositories(connection: DbConnection): ProfileRepositories {
  const Model = connection.model('Profile', schema);
  return {
    forUser(userId) {
      return {
        async findOwn() {
          const row = await Model.findOne({ userId }).lean<Row>();
          return row === null ? null : toProfile(row);
        },
        async insert(profile) {
          try {
            await Model.create({
              _id: profile.id,
              userId,
              locale: profile.locale,
              unitSystem: profile.unitSystem,
              theme: profile.theme,
              quickAccess: profile.quickAccess,
              deletionRequestedAt: null,
              version: profile.version,
              createdAt: toDate(profile.createdAt),
              updatedAt: toDate(profile.updatedAt),
            });
            return true;
          } catch (error) {
            if ((error as { code?: number }).code === MONGO_DUPLICATE_KEY) return false;
            throw error;
          }
        },
        async updatePreferences(id, patch, expectedVersion, now) {
          const row = await updateWithVersion(
            Model as unknown as Model<Row>,
            { userId, id },
            expectedVersion,
            { $set: { ...definedOnly(patch), updatedAt: toDate(now) } },
            'profile',
          );
          return toProfile(row);
        },
        async setQuickAccess(id, quickAccess, expectedVersion, now) {
          const row = await updateWithVersion(
            Model as unknown as Model<Row>,
            { userId, id },
            expectedVersion,
            { $set: { quickAccess, updatedAt: toDate(now) } },
            'profile',
          );
          return toProfile(row);
        },
        async clearQuickAccessOf(setupId, now) {
          const result = await Model.updateOne(
            { userId, 'quickAccess.setupId': setupId },
            { $set: { quickAccess: null, updatedAt: toDate(now) }, $inc: { version: 1 } },
          );
          return result.modifiedCount > 0;
        },
      };
    },
  };
}
