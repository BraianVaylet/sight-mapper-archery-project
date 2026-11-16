import type { Model } from 'mongoose';
import { createBusinessSchema } from '../../../core/db/base-schema.js';
import type { DbConnection } from '../../../core/db/connection.js';
import { fromDate, toDate } from '../../../core/db/temporal.js';
import { rethrowDuplicateId, updateWithVersion } from '../../../core/db/versioned.js';
import { AppError } from '../../../core/http/errors.js';
import type { Mark, MarkRepositories } from '../domain/mark.js';

const MONGO_DUPLICATE_KEY = 11000;

const schema = createBusinessSchema(
  {
    setupId: { type: String, required: true },
    arrowSetId: { type: String, required: true },
    distanceM: { type: Number, required: true },
    scaleValueMm: { type: Number, required: true },
    origin: { type: String, required: true, default: 'measured' },
    note: { type: String },
    measuredAt: { type: Date, required: true },
    /** True when the mark went to the trash with its setup, so restoring the setup brings it back. */
    deletedWithSetup: { type: Boolean, default: false },
  },
  { collection: 'marks' },
);

type Row = {
  _id: string;
  userId: string;
  setupId: string;
  arrowSetId: string;
  distanceM: number;
  scaleValueMm: number;
  origin: Mark['origin'];
  note?: string | null;
  measuredAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const toMark = (row: Row): Mark => ({
  id: row._id,
  userId: row.userId,
  setupId: row.setupId,
  arrowSetId: row.arrowSetId,
  distanceM: row.distanceM,
  scaleValueMm: row.scaleValueMm,
  origin: row.origin,
  ...(row.note == null ? {} : { note: row.note }),
  measuredAt: fromDate(row.measuredAt),
  version: row.version,
  createdAt: fromDate(row.createdAt),
  updatedAt: fromDate(row.updatedAt),
  deletedAt: row.deletedAt === null ? null : fromDate(row.deletedAt),
});

export function createMarkRepositories(connection: DbConnection): MarkRepositories {
  const Marks = connection.model('Mark', schema) as unknown as Model<Row>;

  return {
    forUser(userId) {
      return {
        async listByPair(setupId, arrowSetId, limit) {
          const rows = await Marks.find({ userId, setupId, arrowSetId })
            .sort({ distanceM: 1 })
            .limit(limit)
            .lean<Row[]>();
          return rows.map(toMark);
        },

        async find(id) {
          const row = await Marks.findOne({ _id: id, userId }).lean<Row>();
          return row === null ? null : toMark(row);
        },

        async findInTrash(id) {
          const row = await Marks.findOne({ _id: id, userId, deletedAt: { $ne: null } })
            .setOptions({ withDeleted: true })
            .lean<Row>();
          return row === null ? null : toMark(row);
        },

        async findAtDistance(setupId, arrowSetId, distanceM) {
          const row = await Marks.findOne({ userId, setupId, arrowSetId, distanceM }).lean<Row>();
          return row === null ? null : toMark(row);
        },

        async insert(mark) {
          try {
            await Marks.create({
              _id: mark.id,
              userId,
              setupId: mark.setupId,
              arrowSetId: mark.arrowSetId,
              distanceM: mark.distanceM,
              scaleValueMm: mark.scaleValueMm,
              origin: mark.origin,
              ...(mark.note == null ? {} : { note: mark.note }),
              measuredAt: toDate(mark.measuredAt),
              version: mark.version,
              createdAt: toDate(mark.createdAt),
              updatedAt: toDate(mark.updatedAt),
            });
          } catch (error) {
            rethrowDuplicateId(error, 'mark');
          }
        },

        async update(id, patch, expectedVersion, now) {
          const set: Record<string, unknown> = { updatedAt: toDate(now) };
          const unset: Record<string, 1> = {};
          if (patch.distanceM !== undefined) set['distanceM'] = patch.distanceM;
          if (patch.scaleValueMm !== undefined) set['scaleValueMm'] = patch.scaleValueMm;
          if (patch.measuredAt !== undefined) set['measuredAt'] = toDate(patch.measuredAt);
          if (patch.note === null) unset['note'] = 1;
          else if (patch.note !== undefined) set['note'] = patch.note;
          const row = await updateWithVersion(
            Marks,
            { userId, id },
            expectedVersion,
            { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
            'mark',
          );
          return toMark(row);
        },

        async softDelete(id, expectedVersion, now) {
          await updateWithVersion(
            Marks,
            { userId, id },
            expectedVersion,
            { $set: { deletedAt: toDate(now), updatedAt: toDate(now) } },
            'mark',
          );
        },

        async restore(id, now) {
          try {
            const row = await Marks.findOneAndUpdate(
              { _id: id, userId, deletedAt: { $ne: null } },
              { $set: { deletedAt: null, updatedAt: toDate(now) }, $inc: { version: 1 } },
              { new: true, withDeleted: true },
            ).lean<Row>();
            if (row === null) throw new AppError('SM-CORE-404-002', { resource: 'mark' });
            return toMark(row);
          } catch (error) {
            // The unique index says the distance is taken again: the use case checks first, this is the race.
            const e = error as { code?: number };
            if (e.code === MONGO_DUPLICATE_KEY) {
              throw new AppError('SM-MARK-409-001', { existingMarkId: null, distanceM: null });
            }
            throw error;
          }
        },

        async countBySetup(setupIds) {
          if (setupIds.length === 0) return new Map();
          const rows = await Marks.aggregate<{ _id: string; n: number }>([
            { $match: { userId, setupId: { $in: [...setupIds] }, deletedAt: null } },
            { $group: { _id: '$setupId', n: { $sum: 1 } } },
          ]);
          return new Map(rows.map((row) => [row._id, row.n]));
        },

        countForArrowSet: (setupId, arrowSetId) =>
          Marks.countDocuments({ userId, setupId, arrowSetId }),

        async trashBySetup(setupId, now) {
          await Marks.updateMany(
            { userId, setupId },
            {
              $set: { deletedAt: toDate(now), deletedWithSetup: true, updatedAt: toDate(now) },
              $inc: { version: 1 },
            },
          );
        },

        async restoreBySetup(setupId, now) {
          await Marks.updateMany(
            { userId, setupId, deletedWithSetup: true, deletedAt: { $ne: null } },
            {
              $set: { deletedAt: null, deletedWithSetup: false, updatedAt: toDate(now) },
              $inc: { version: 1 },
            },
          ).setOptions({ withDeleted: true });
        },

        async positionsOf(setupIds) {
          if (setupIds.length === 0) return [];
          const rows = await Marks.find({ userId, setupId: { $in: [...setupIds] } })
            .select('scaleValueMm')
            .lean<{ scaleValueMm: number }[]>();
          return rows.map((row) => row.scaleValueMm);
        },

        async scalePositions(setupIds, factor, now) {
          if (setupIds.length === 0) return;
          // One pipeline update: every position times the factor, rounded to a millionth of a mm.
          await Marks.updateMany({ userId, setupId: { $in: [...setupIds] } }, [
            {
              $set: {
                scaleValueMm: { $round: [{ $multiply: ['$scaleValueMm', factor] }, 6] },
                updatedAt: toDate(now),
                version: { $add: ['$version', 1] },
              },
            },
          ]);
        },
      };
    },
  };
}
