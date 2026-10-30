import type { ClientSession, Model, UpdateQuery } from 'mongoose';
import { AppError } from '../http/errors.js';

const MONGO_DUPLICATE_KEY = 11000;

type Versioned = { version: number };

/**
 * Optimistic write: updates the document only if it is still at `expectedVersion`, and bumps
 * `version` in the same operation. A stale `If-Match` is `SM-CORE-412-001`, never a silent
 * last-write-wins; a document that is not yours or not there is `SM-CORE-404-002` (ADR-000).
 */
export async function updateWithVersion<T extends Versioned>(
  model: Model<T>,
  scope: { readonly userId: string; readonly id: string },
  expectedVersion: number,
  update: UpdateQuery<T>,
  resource: string,
  session?: ClientSession,
): Promise<T> {
  const filter = { _id: scope.id, userId: scope.userId, version: expectedVersion };
  const next = {
    ...update,
    $inc: { ...(update.$inc as Record<string, number> | undefined), version: 1 },
  };
  const updated = await model
    .findOneAndUpdate(filter as never, next as never, {
      new: true,
      ...(session ? { session } : {}),
    })
    .lean();
  if (updated !== null) return updated as T;

  const current = await model
    .findOne({ _id: scope.id, userId: scope.userId } as never, null, session ? { session } : {})
    .lean();
  if (current === null) throw new AppError('SM-CORE-404-002', { resource });
  throw new AppError('SM-CORE-412-001', { currentVersion: (current as Versioned).version });
}

/**
 * A POST whose client-made `_id` already exists is `SM-CORE-409-002`. Other duplicate-key
 * errors (a business unique index) are left for the module that owns the index.
 */
export function rethrowDuplicateId(error: unknown, resource: string): never {
  const e = error as { code?: number; keyPattern?: Record<string, unknown> };
  if (e.code === MONGO_DUPLICATE_KEY && e.keyPattern !== undefined && '_id' in e.keyPattern) {
    throw new AppError('SM-CORE-409-002', { resource }, { cause: error });
  }
  throw error;
}
