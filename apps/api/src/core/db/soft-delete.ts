import type { Schema } from 'mongoose';

declare module 'mongoose' {
  interface QueryOptions {
    /** Include soft-deleted documents (trash and purge jobs only). */
    withDeleted?: boolean;
  }
}

const FILTERED_OPERATIONS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
  'countDocuments',
] as const;

/**
 * Soft delete (ADR-006): documents are never removed by the API, they get a `deletedAt`. Reads
 * skip them unless the query opts in with `withDeleted`. The field is stored as an explicit
 * `null` while alive, which the partial unique indexes rely on (`deletedAt: { $type: 'null' }`).
 */
export function softDeletePlugin(schema: Schema): void {
  schema.add({ deletedAt: { type: Date, default: null } });

  for (const operation of FILTERED_OPERATIONS) {
    schema.pre(operation, function () {
      if (this.getOptions().withDeleted === true) return;
      if (this.getFilter()['deletedAt'] === undefined) this.where({ deletedAt: null });
    });
  }
}
