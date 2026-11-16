import type { Schema } from 'mongoose';
import { AppError } from '../http/errors.js';

/** Query operations that read or change documents: each must be scoped by `userId` (ADR-000). */
const QUERY_OPERATIONS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'countDocuments',
  'distinct',
] as const;

/** A scoped filter names `userId` with an actual value; `undefined` would match everything. */
function isScoped(filter: Record<string, unknown>): boolean {
  const userId = filter['userId'];
  return userId !== undefined && userId !== null;
}

/**
 * Data-isolation plugin. A query without `userId` is a bug that could expose another archer's
 * data, so it fails loudly (`SM-CORE-500-002`) instead of returning everything. Applies to
 * queries, saves, `insertMany` and aggregations; `estimatedDocumentCount` has no filter and is
 * therefore refused.
 */
export function isolationPlugin(schema: Schema): void {
  for (const operation of QUERY_OPERATIONS) {
    schema.pre(operation, function () {
      if (!isScoped(this.getFilter() as Record<string, unknown>)) {
        throw new AppError('SM-CORE-500-002', { operation });
      }
    });
  }

  schema.pre('estimatedDocumentCount', function () {
    throw new AppError('SM-CORE-500-002', { operation: 'estimatedDocumentCount' });
  });

  // `validate` runs before Mongoose's own `required` check, so the violation is reported as ours.
  schema.pre('validate', function () {
    if (!isScoped(this.toObject() as Record<string, unknown>)) {
      throw new AppError('SM-CORE-500-002', { operation: 'save' });
    }
  });

  // Callback-style hook (it receives the docs): it must call `next()` or the insert hangs.
  schema.pre('insertMany', function (next, docs: unknown) {
    const list = Array.isArray(docs) ? docs : [docs];
    for (const doc of list) {
      if (!isScoped((doc ?? {}) as Record<string, unknown>)) {
        throw new AppError('SM-CORE-500-002', { operation: 'insertMany' });
      }
    }
    next();
  });

  schema.pre('aggregate', function () {
    const first = this.pipeline()[0] as { $match?: Record<string, unknown> } | undefined;
    if (first?.$match === undefined || !isScoped(first.$match)) {
      throw new AppError('SM-CORE-500-002', { operation: 'aggregate' });
    }
  });
}
