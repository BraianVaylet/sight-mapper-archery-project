import type { Model, SchemaDefinition } from 'mongoose';
import { createBusinessSchema } from '../../../core/db/base-schema.js';
import type { DbConnection } from '../../../core/db/connection.js';
import { decodeCursor, encodeCursor } from '../../../core/db/cursor.js';
import { fromDate, toDate } from '../../../core/db/temporal.js';
import { rethrowDuplicateId, updateWithVersion } from '../../../core/db/versioned.js';
import { AppError } from '../../../core/http/errors.js';
import type { ComponentMeta, ComponentRepositories } from '../domain/component.js';

export type ComponentCollection = {
  readonly connection: DbConnection;
  readonly modelName: string;
  readonly collection: string;
  /** For the 404 and the duplicate-id error: `'arrow set'`. */
  readonly resource: string;
  /** The fields the archer describes, flat on the document. The rest is `ComponentMeta`. */
  readonly definition: SchemaDefinition;
  /** Shapes a value on its way to the database (a sight's scale is stored without nulls). */
  readonly store?: (name: string, value: unknown) => unknown;
};

type Row = Record<string, unknown> & {
  _id: string;
  userId: string;
  status: ComponentMeta['status'];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const META_KEYS = new Set([
  'id',
  'userId',
  'status',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

/**
 * The persistence of one kind of equipment whose described fields live flat on the document
 * (arrow sets; bows and sights follow). A stored `null` and a missing field mean the same thing
 * to the archer — not filled in — so neither reaches the domain.
 */
export function createComponentRepositories<E extends ComponentMeta, Patch extends object>(
  options: ComponentCollection,
): ComponentRepositories<E, Patch> {
  const { connection, modelName, collection, resource, definition } = options;
  const store = options.store ?? ((_name: string, value: unknown) => value);
  const fieldNames = Object.keys(definition).filter((name) => !['status'].includes(name));
  const schema = createBusinessSchema(
    { status: { type: String, required: true, default: 'active' }, ...definition },
    { collection },
  );
  const Docs = connection.model(modelName, schema) as unknown as Model<Row>;

  const toEntity = (row: Row): E =>
    ({
      ...Object.fromEntries(
        fieldNames
          .filter((name) => row[name] !== undefined && row[name] !== null)
          .map((name) => [name, row[name]]),
      ),
      id: row._id,
      userId: row.userId,
      status: row.status,
      version: row.version,
      createdAt: fromDate(row.createdAt),
      updatedAt: fromDate(row.updatedAt),
      deletedAt: row.deletedAt === null ? null : fromDate(row.deletedAt),
    }) as unknown as E;

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
          const rows = await Docs.find({ userId, status, ...after })
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean<Row[]>();
          const shown = rows.slice(0, limit);
          const last = shown[shown.length - 1];
          return {
            items: shown.map(toEntity),
            nextCursor:
              rows.length > limit && last !== undefined
                ? encodeCursor({ updatedAt: last.updatedAt, id: last._id })
                : null,
          };
        },

        async find(id) {
          const row = await Docs.findOne({ _id: id, userId }).lean<Row>();
          return row === null ? null : toEntity(row);
        },

        async insert(entity) {
          const described = Object.fromEntries(
            Object.entries(entity)
              .filter(
                ([name, value]) => !META_KEYS.has(name) && value !== undefined && value !== null,
              )
              .map(([name, value]) => [name, store(name, value)]),
          );
          try {
            await Docs.create({
              ...described,
              _id: entity.id,
              userId,
              status: entity.status,
              version: entity.version,
              createdAt: toDate(entity.createdAt),
              updatedAt: toDate(entity.updatedAt),
            });
          } catch (error) {
            rethrowDuplicateId(error, resource);
          }
        },

        async update(id, patch, expectedVersion, now) {
          const set: Record<string, unknown> = { updatedAt: toDate(now) };
          const unset: Record<string, 1> = {};
          for (const [name, value] of Object.entries(patch)) {
            if (value === undefined) continue;
            if (value === null) unset[name] = 1;
            else set[name] = store(name, value);
          }
          const row = await updateWithVersion(
            Docs,
            { userId, id },
            expectedVersion,
            { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
            resource,
          );
          return toEntity(row);
        },

        async setStatus(id, status, now) {
          const row = await Docs.findOneAndUpdate(
            { _id: id, userId },
            { $set: { status, updatedAt: toDate(now) }, $inc: { version: 1 } },
            { new: true },
          ).lean<Row>();
          if (row === null) throw new AppError('SM-CORE-404-002', { resource });
          return toEntity(row);
        },

        async softDelete(id, expectedVersion, now) {
          await updateWithVersion(
            Docs,
            { userId, id },
            expectedVersion,
            { $set: { deletedAt: toDate(now), updatedAt: toDate(now) } },
            resource,
          );
        },
      };
    },
  };
}
