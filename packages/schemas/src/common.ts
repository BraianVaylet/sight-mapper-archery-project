import { COMPONENT_STATUSES } from '@sight-mapper/types';
import { z } from 'zod';

/**
 * Custom refinements carry a stable message key (`validation.*`) instead of prose: the API turns
 * issues into `{ path, messageKey, params }` and the client translates (errors.md §2).
 */

export const uuidv7 = z.uuidv7();

export const isoDateTime = z.iso.datetime({ offset: true });

/** Trimmed text of `min..max` characters. */
export const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** A finite number in `min..max`, inclusive. */
export const bounded = (min: number, max: number) => z.number().min(min).max(max);

/** Optional field that may also be cleared with `null`. */
export const optional = <T extends z.ZodType>(schema: T) => schema.nullish();

/** Fields every persisted resource carries on the wire (DICCIONARIO §3). */
export const resourceFields = {
  id: uuidv7,
  version: z.int().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.nullable(),
};

export const componentStatus = z.enum(COMPONENT_STATUSES);

/** Opaque cursor over `(updatedAt, _id)`: base64url (DICCIONARIO §4). */
export const cursor = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const listQuery = z.object({
  status: componentStatus.default('active'),
  cursor: cursor.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

/** `{ items, nextCursor }`: the only list shape (TECNICO §4). */
export const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: cursor.nullable(),
  });

export const at = (path: string[], message: string) => ({ path, message });

/** True when `value` has at most 3 decimals (distances are canonical to 1 mm). */
export const isMillimetre = (value: number): boolean =>
  Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
