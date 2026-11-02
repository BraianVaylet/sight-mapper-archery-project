import type { Model } from 'mongoose';
import { createBusinessSchema } from '../../../core/db/base-schema.js';
import type { DbConnection } from '../../../core/db/connection.js';
import { decodeGroupedCursor, encodeGroupedCursor } from '../../../core/db/cursor.js';
import { fromDate, toDate } from '../../../core/db/temporal.js';
import { rethrowDuplicateId, updateWithVersion } from '../../../core/db/versioned.js';
import { AppError } from '../../../core/http/errors.js';
import type { Setup, SetupRepositories } from '../domain/setup.js';

const MONGO_DUPLICATE_KEY = 11000;

const schema = createBusinessSchema(
  {
    name: { type: String },
    bowId: { type: String, required: true },
    sightId: { type: String, required: true },
    arrowSetIds: { type: [String], required: true },
    isFavorite: { type: Boolean, required: true, default: false },
    status: { type: String, required: true, default: 'active' },
  },
  { collection: 'setups' },
);

type Row = {
  _id: string;
  userId: string;
  name?: string | null;
  bowId: string;
  sightId: string;
  arrowSetIds: string[];
  isFavorite: boolean;
  status: Setup['status'];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const toSetup = (row: Row): Setup => ({
  id: row._id,
  userId: row.userId,
  ...(row.name === undefined || row.name === null ? {} : { name: row.name }),
  bowId: row.bowId,
  sightId: row.sightId,
  arrowSetIds: row.arrowSetIds,
  isFavorite: row.isFavorite,
  status: row.status,
  version: row.version,
  createdAt: fromDate(row.createdAt),
  updatedAt: fromDate(row.updatedAt),
  deletedAt: row.deletedAt === null ? null : fromDate(row.deletedAt),
});

const FIELD_OF = { bow: 'bowId', sight: 'sightId', arrowSet: 'arrowSetIds' } as const;

export function createSetupRepositories(connection: DbConnection): SetupRepositories {
  const Setups = connection.model('Setup', schema) as unknown as Model<Row>;

  return {
    forUser(userId) {
      const repository: ReturnType<SetupRepositories['forUser']> = {
        async list({ status, cursor, limit }) {
          const after =
            cursor === undefined
              ? {}
              : (() => {
                  const at = decodeGroupedCursor(cursor);
                  return {
                    $or: [
                      { isFavorite: { $lt: at.group } },
                      { isFavorite: at.group, updatedAt: { $lt: at.updatedAt } },
                      { isFavorite: at.group, updatedAt: at.updatedAt, _id: { $lt: at.id } },
                    ],
                  };
                })();
          const rows = await Setups.find({ userId, status, ...after })
            .sort({ isFavorite: -1, updatedAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean<Row[]>();
          const shown = rows.slice(0, limit);
          const last = shown[shown.length - 1];
          return {
            items: shown.map(toSetup),
            nextCursor:
              rows.length > limit && last !== undefined
                ? encodeGroupedCursor({
                    group: last.isFavorite,
                    updatedAt: last.updatedAt,
                    id: last._id,
                  })
                : null,
          };
        },

        async find(id) {
          const row = await Setups.findOne({ _id: id, userId }).lean<Row>();
          return row === null ? null : toSetup(row);
        },

        async findByPair(bowId, sightId) {
          const row = await Setups.findOne({ userId, bowId, sightId }).lean<Row>();
          return row === null ? null : toSetup(row);
        },

        async insert(setup) {
          try {
            await Setups.create({
              _id: setup.id,
              userId,
              ...(setup.name == null ? {} : { name: setup.name }),
              bowId: setup.bowId,
              sightId: setup.sightId,
              arrowSetIds: [...setup.arrowSetIds],
              isFavorite: setup.isFavorite,
              status: setup.status,
              version: setup.version,
              createdAt: toDate(setup.createdAt),
              updatedAt: toDate(setup.updatedAt),
            });
          } catch (error) {
            await rethrowPairOrId(error, setup.bowId, setup.sightId);
          }
        },

        async update(id, patch, expectedVersion, now) {
          const set: Record<string, unknown> = { updatedAt: toDate(now) };
          const unset: Record<string, 1> = {};
          if (patch.name === null) unset['name'] = 1;
          else if (patch.name !== undefined) set['name'] = patch.name;
          if (patch.isFavorite !== undefined) set['isFavorite'] = patch.isFavorite;
          if (patch.arrowSetIds !== undefined) set['arrowSetIds'] = [...patch.arrowSetIds];
          const row = await updateWithVersion(
            Setups,
            { userId, id },
            expectedVersion,
            { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
            'setup',
          );
          return toSetup(row);
        },

        async setStatus(id, status, now) {
          const row = await Setups.findOneAndUpdate(
            { _id: id, userId },
            { $set: { status, updatedAt: toDate(now) }, $inc: { version: 1 } },
            { new: true },
          ).lean<Row>();
          if (row === null) throw new AppError('SM-CORE-404-002', { resource: 'setup' });
          return toSetup(row);
        },

        async moveToTrash(id, expectedVersion, now) {
          await updateWithVersion(
            Setups,
            { userId, id },
            expectedVersion,
            { $set: { deletedAt: toDate(now), updatedAt: toDate(now) } },
            'setup',
          );
        },

        async listTrash() {
          const rows = await Setups.find({ userId, deletedAt: { $ne: null } })
            .setOptions({ withDeleted: true })
            .sort({ deletedAt: -1, _id: -1 })
            .lean<Row[]>();
          return rows.map(toSetup);
        },

        async findInTrash(id) {
          const row = await Setups.findOne({ _id: id, userId, deletedAt: { $ne: null } })
            .setOptions({ withDeleted: true })
            .lean<Row>();
          return row === null ? null : toSetup(row);
        },

        async restore(id, now) {
          try {
            const row = await Setups.findOneAndUpdate(
              { _id: id, userId, deletedAt: { $ne: null } },
              { $set: { deletedAt: null, updatedAt: toDate(now) }, $inc: { version: 1 } },
              { new: true, withDeleted: true },
            ).lean<Row>();
            if (row === null) throw new AppError('SM-CORE-404-002', { resource: 'setup' });
            return toSetup(row);
          } catch (error) {
            // Another setup took the pair while this one was in the trash (RN-STP-03).
            const current = await Setups.findOne({ _id: id, userId })
              .setOptions({ withDeleted: true })
              .lean<Row>();
            if (current !== null) await rethrowPairOrId(error, current.bowId, current.sightId);
            throw error;
          }
        },

        async idsUsing(kind, componentId) {
          const rows = await Setups.find({ userId, [FIELD_OF[kind]]: componentId })
            .select('_id')
            .lean<{ _id: string }[]>();
          return rows.map((row) => row._id);
        },
      };

      /** The partial unique index on (bow, sight) says "that pair is taken": tell which setup has it. */
      async function rethrowPairOrId(
        error: unknown,
        bowId: string,
        sightId: string,
      ): Promise<never> {
        const e = error as { code?: number; keyPattern?: Record<string, unknown> };
        if (
          e.code === MONGO_DUPLICATE_KEY &&
          e.keyPattern !== undefined &&
          'bowId' in e.keyPattern
        ) {
          const existing = await repository.findByPair(bowId, sightId);
          throw new AppError('SM-STP-409-001', { existingSetupId: existing?.id ?? null });
        }
        return rethrowDuplicateId(error, 'setup');
      }

      return repository;
    },
  };
}
