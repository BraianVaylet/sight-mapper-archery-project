import { Schema } from 'mongoose';
import type { Clock } from '../clock/clock.js';
import { fromDate, toDate } from '../db/temporal.js';
import type { DbConnection } from '../db/connection.js';
import { isolationPlugin } from '../db/isolation.js';
import type { IdempotencyRecord, IdempotencyStore } from './idempotency.js';

const MONGO_DUPLICATE_KEY = 11000;

const schema = new Schema(
  {
    userId: { type: String, required: true },
    key: { type: String, required: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    requestHash: { type: String, required: true },
    statusCode: { type: Number, required: true },
    responseBody: { type: String, required: true },
    responseHeaders: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'idempotencyKeys', versionKey: false, timestamps: false },
);
// Always scoped by user: one archer's key can never match another's (ADR-000).
schema.plugin(isolationPlugin);

/**
 * `idempotencyKeys`, expired by the TTL index on `expiresAt` (created by the migration).
 * A lookup filters on `expiresAt` too, because the TTL sweep runs only once a minute.
 */
export function createMongoIdempotencyStore(
  connection: DbConnection,
  clock: Clock,
): IdempotencyStore {
  const Model = connection.model('IdempotencyKey', schema);

  return {
    async find(userId, key) {
      const doc = await Model.findOne({
        userId,
        key,
        expiresAt: { $gt: toDate(clock.now()) },
      }).lean();
      if (doc === null) return null;
      return {
        userId: doc.userId,
        key: doc.key,
        method: doc.method,
        path: doc.path,
        requestHash: doc.requestHash,
        statusCode: doc.statusCode,
        responseBody: doc.responseBody,
        responseHeaders: doc.responseHeaders as Record<string, string>,
        createdAt: fromDate(doc.createdAt),
        expiresAt: fromDate(doc.expiresAt),
      };
    },
    async save(record: IdempotencyRecord) {
      try {
        await Model.create({
          ...record,
          createdAt: toDate(record.createdAt),
          expiresAt: toDate(record.expiresAt),
        });
      } catch (error) {
        if ((error as { code?: number }).code !== MONGO_DUPLICATE_KEY) throw error;
      }
    },
  };
}
