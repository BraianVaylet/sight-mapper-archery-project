import type { SightScaleInput } from '@sight-mapper/schemas';
import { Schema, type Model, type SchemaDefinition } from 'mongoose';
import { createBusinessSchema } from '../../../core/db/base-schema.js';
import type { DbConnection } from '../../../core/db/connection.js';
import { decodeCursor, encodeCursor } from '../../../core/db/cursor.js';
import { fromDate, toDate } from '../../../core/db/temporal.js';
import { rethrowDuplicateId, updateWithVersion } from '../../../core/db/versioned.js';
import { AppError } from '../../../core/http/errors.js';
import type { Sight, SightRepositories } from '../domain/sight.js';

const TEXT_FIELDS = ['nickname', 'manufacturer', 'model', 'notes'] as const;

const definition: SchemaDefinition = {
  status: { type: String, required: true, default: 'active' },
  pinType: { type: String, required: true },
  // The scale is one value: it is read and replaced as a whole, never patched key by key.
  scale: { type: Schema.Types.Mixed, required: true },
  ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, { type: String }])),
};

const schema = createBusinessSchema(definition, { collection: 'sights' });

type Row = Record<string, unknown> & {
  _id: string;
  userId: string;
  status: Sight['status'];
  pinType: Sight['pinType'];
  scale: SightScaleInput;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** A `null` unit size and a missing one are the same: no physical size known. */
const cleanScale = (scale: SightScaleInput): SightScaleInput => ({
  unit: scale.unit,
  min: scale.min,
  max: scale.max,
  resolution: scale.resolution,
  direction: scale.direction,
  ...(scale.unitSizeMm == null ? {} : { unitSizeMm: scale.unitSizeMm }),
});

function toSight(row: Row): Sight {
  const described = Object.fromEntries(
    TEXT_FIELDS.filter((name) => row[name] !== undefined && row[name] !== null).map((name) => [
      name,
      row[name],
    ]),
  );
  return {
    ...described,
    id: row._id,
    userId: row.userId,
    status: row.status,
    pinType: row.pinType,
    scale: row.scale,
    version: row.version,
    createdAt: fromDate(row.createdAt),
    updatedAt: fromDate(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : fromDate(row.deletedAt),
  };
}

export function createSightRepositories(connection: DbConnection): SightRepositories {
  const Sights = connection.model('Sight', schema) as unknown as Model<Row>;

  return {
    forUser(userId) {
      return {
        async list({ status, cursor, limit }) {
          const after =
            cursor === undefined
              ? {}
              : (() => {
                  const position = decodeCursor(cursor);
                  return {
                    $or: [
                      { updatedAt: { $lt: position.updatedAt } },
                      { updatedAt: position.updatedAt, _id: { $lt: position.id } },
                    ],
                  };
                })();
          const rows = await Sights.find({ userId, status, ...after })
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean<Row[]>();
          const shown = rows.slice(0, limit);
          const last = shown[shown.length - 1];
          return {
            items: shown.map(toSight),
            nextCursor:
              rows.length > limit && last !== undefined
                ? encodeCursor({ updatedAt: last.updatedAt, id: last._id })
                : null,
          };
        },

        async find(id) {
          const row = await Sights.findOne({ _id: id, userId }).lean<Row>();
          return row === null ? null : toSight(row);
        },

        async insert(sight) {
          const described = Object.fromEntries(
            TEXT_FIELDS.map((name) => [name, sight[name]]).filter(
              ([, value]) => value !== undefined && value !== null,
            ),
          );
          try {
            await Sights.create({
              ...described,
              _id: sight.id,
              userId,
              status: sight.status,
              pinType: sight.pinType,
              scale: cleanScale(sight.scale),
              version: sight.version,
              createdAt: toDate(sight.createdAt),
              updatedAt: toDate(sight.updatedAt),
            });
          } catch (error) {
            rethrowDuplicateId(error, 'sight');
          }
        },

        async update(id, patch, expectedVersion, now) {
          const set: Record<string, unknown> = { updatedAt: toDate(now) };
          const unset: Record<string, 1> = {};
          for (const [name, value] of Object.entries(patch)) {
            if (value === undefined) continue;
            if (value === null) unset[name] = 1;
            else set[name] = name === 'scale' ? cleanScale(value as SightScaleInput) : value;
          }
          const row = await updateWithVersion(
            Sights,
            { userId, id },
            expectedVersion,
            { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
            'sight',
          );
          return toSight(row);
        },

        async setStatus(id, status, now) {
          const row = await Sights.findOneAndUpdate(
            { _id: id, userId },
            { $set: { status, updatedAt: toDate(now) }, $inc: { version: 1 } },
            { new: true },
          ).lean<Row>();
          if (row === null) throw new AppError('SM-CORE-404-002', { resource: 'sight' });
          return toSight(row);
        },

        async softDelete(id, expectedVersion, now) {
          await updateWithVersion(
            Sights,
            { userId, id },
            expectedVersion,
            { $set: { deletedAt: toDate(now), updatedAt: toDate(now) } },
            'sight',
          );
        },
      };
    },
  };
}
