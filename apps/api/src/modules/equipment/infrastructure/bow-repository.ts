import { bowFields } from '@sight-mapper/schemas';
import type { Model, SchemaDefinition } from 'mongoose';
import { createBusinessSchema } from '../../../core/db/base-schema.js';
import type { DbConnection } from '../../../core/db/connection.js';
import { decodeCursor, encodeCursor } from '../../../core/db/cursor.js';
import { fromDate, toDate } from '../../../core/db/temporal.js';
import { rethrowDuplicateId, updateWithVersion } from '../../../core/db/versioned.js';
import { AppError } from '../../../core/http/errors.js';
import type { Bow, BowRepositories } from '../domain/bow.js';

const STRING_FIELDS = ['bowType', 'nickname', 'manufacturer', 'model', 'camType', 'rest', 'notes'];

/** Every descriptive field of a bow, from the shared schema: one list for both front and back. */
const FIELD_NAMES = Object.keys(bowFields);

const definition: SchemaDefinition = {
  status: { type: String, required: true, default: 'active' },
  ...Object.fromEntries(
    FIELD_NAMES.map((name) => [name, { type: STRING_FIELDS.includes(name) ? String : Number }]),
  ),
};
definition['bowType'] = { type: String, required: true };

const schema = createBusinessSchema(definition, { collection: 'bows' });

type Row = Record<string, unknown> & {
  _id: string;
  userId: string;
  status: Bow['status'];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** A stored `null` or a missing field is the same thing for the archer: not filled in. */
function toBow(row: Row): Bow {
  const described = Object.fromEntries(
    FIELD_NAMES.filter((name) => row[name] !== undefined && row[name] !== null).map((name) => [
      name,
      row[name],
    ]),
  );
  return {
    ...(described as Pick<Bow, 'bowType'>),
    id: row._id,
    userId: row.userId,
    status: row.status,
    version: row.version,
    createdAt: fromDate(row.createdAt),
    updatedAt: fromDate(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : fromDate(row.deletedAt),
  };
}

export function createBowRepositories(connection: DbConnection): BowRepositories {
  const Bows = connection.model('Bow', schema) as unknown as Model<Row>;

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
          // One more than asked: it says whether there is a next page without a second query.
          const rows = await Bows.find({ userId, status, ...after })
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean<Row[]>();
          const shown = rows.slice(0, limit);
          const last = shown[shown.length - 1];
          return {
            items: shown.map(toBow),
            nextCursor:
              rows.length > limit && last !== undefined
                ? encodeCursor({ updatedAt: last.updatedAt, id: last._id })
                : null,
          };
        },

        async find(id) {
          const row = await Bows.findOne({ _id: id, userId }).lean<Row>();
          return row === null ? null : toBow(row);
        },

        async insert(bow) {
          const described = Object.fromEntries(
            FIELD_NAMES.map((name) => [name, (bow as Record<string, unknown>)[name]]).filter(
              ([, value]) => value !== undefined && value !== null,
            ),
          );
          try {
            await Bows.create({
              ...described,
              _id: bow.id,
              userId,
              status: bow.status,
              version: bow.version,
              createdAt: toDate(bow.createdAt),
              updatedAt: toDate(bow.updatedAt),
            });
          } catch (error) {
            rethrowDuplicateId(error, 'bow');
          }
        },

        async update(id, patch, expectedVersion, now) {
          const set: Record<string, unknown> = { updatedAt: toDate(now) };
          const unset: Record<string, 1> = {};
          for (const [name, value] of Object.entries(patch)) {
            if (value === undefined) continue;
            if (value === null) unset[name] = 1;
            else set[name] = value;
          }
          const row = await updateWithVersion(
            Bows,
            { userId, id },
            expectedVersion,
            { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
            'bow',
          );
          return toBow(row);
        },

        async setStatus(id, status, now) {
          const row = await Bows.findOneAndUpdate(
            { _id: id, userId },
            { $set: { status, updatedAt: toDate(now) }, $inc: { version: 1 } },
            { new: true },
          ).lean<Row>();
          if (row === null) throw new AppError('SM-CORE-404-002', { resource: 'bow' });
          return toBow(row);
        },

        async softDelete(id, expectedVersion, now) {
          await updateWithVersion(
            Bows,
            { userId, id },
            expectedVersion,
            { $set: { deletedAt: toDate(now), updatedAt: toDate(now) } },
            'bow',
          );
        },
      };
    },
  };
}
