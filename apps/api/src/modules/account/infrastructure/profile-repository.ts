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
    units: {
      marks: { type: String, required: true },
      bow: { type: String, required: true },
      arrows: { type: String, required: true },
      sight: { type: String, required: true },
    },
    theme: { type: String, required: true },
    doctorToleranceMm: { type: Number, default: null },
    quickAccess: { type: Schema.Types.Mixed, default: null },
    deletionRequestedAt: { type: Date, default: null },
  },
  { collection: 'profiles' },
);

type Row = {
  _id: string;
  userId: string;
  locale: Profile['locale'];
  units: Profile['units'];
  theme: Profile['theme'];
  /** Absent in profiles from before F1-40: read as the default. */
  doctorToleranceMm?: number | null;
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
  units: {
    marks: row.units.marks,
    bow: row.units.bow,
    arrows: row.units.arrows,
    sight: row.units.sight,
  },
  theme: row.theme,
  doctorToleranceMm: row.doctorToleranceMm ?? null,
  quickAccess: row.quickAccess ?? null,
  deletionRequestedAt: row.deletionRequestedAt === null ? null : fromDate(row.deletionRequestedAt),
  version: row.version,
  createdAt: fromDate(row.createdAt),
  updatedAt: fromDate(row.updatedAt),
});

/**
 * The `$set` of a preferences patch: `{ theme: undefined }` must not become a write (Mongo would
 * store a null), and a section of the units is set by its own path (`units.bow`), so the others
 * stay as they are.
 */
const setOf = (patch: PreferencesPatch): Record<string, string | number | null> => {
  const set: Record<string, string | number | null> = {};
  if (patch.locale !== undefined) set['locale'] = patch.locale;
  if (patch.theme !== undefined) set['theme'] = patch.theme;
  // `null` is a value here: it puts the default back.
  if (patch.doctorToleranceMm !== undefined) set['doctorToleranceMm'] = patch.doctorToleranceMm;
  for (const [section, system] of Object.entries(patch.units ?? {})) {
    if (system !== undefined) set[`units.${section}`] = system;
  }
  return set;
};

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
              units: profile.units,
              theme: profile.theme,
              doctorToleranceMm: profile.doctorToleranceMm,
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
            { $set: { ...setOf(patch), updatedAt: toDate(now) } },
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
        async requestDeletion(id, now) {
          // The condition is part of the write: two requests at once, only one wins.
          const row = await Model.findOneAndUpdate(
            { userId, _id: id, deletionRequestedAt: null },
            {
              $set: { deletionRequestedAt: toDate(now), updatedAt: toDate(now) },
              $inc: { version: 1 },
            },
            { new: true },
          ).lean<Row>();
          return row === null ? null : toProfile(row);
        },
        async cancelDeletion(id, now) {
          const row = await Model.findOneAndUpdate(
            { userId, _id: id, deletionRequestedAt: { $ne: null } },
            { $set: { deletionRequestedAt: null, updatedAt: toDate(now) }, $inc: { version: 1 } },
            { new: true },
          ).lean<Row>();
          return row === null ? null : toProfile(row);
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
