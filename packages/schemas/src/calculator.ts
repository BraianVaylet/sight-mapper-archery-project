import { MARK_ORIGINS } from '@sight-mapper/types';
import { z } from 'zod';
import {
  bounded,
  componentStatus,
  isMillimetre,
  isoDateTime,
  optional,
  resourceFields,
  text,
  uuidv7,
} from './common.js';

// -------------------------------------------------------------- setups

const arrowSetIds = z
  .array(uuidv7)
  .min(1)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, 'validation.setup.duplicateArrowSets');

export const setupFields = {
  name: optional(text(1, 60)),
  bowId: uuidv7,
  sightId: uuidv7,
  arrowSetIds,
  isFavorite: z.boolean().default(false),
};

export const createSetup = z.object({ id: uuidv7, ...setupFields });
export type CreateSetup = z.infer<typeof createSetup>;

/** The bow and the sight of a setup never change: a different pair is a different setup. */
export const updateSetup = z
  .object({
    name: setupFields.name,
    arrowSetIds,
    isFavorite: z.boolean(),
  })
  .partial();
export type UpdateSetup = z.infer<typeof updateSetup>;

export const setup = z.object({
  ...resourceFields,
  ...setupFields,
  status: componentStatus,
});
export type Setup = z.infer<typeof setup>;

// --------------------------------------------------------------- marks

/** Metres, up to 1 mm, within the range an archer can shoot (DICCIONARIO §3.5). */
const distanceM = bounded(0, 300).gt(0).refine(isMillimetre, 'validation.mark.distancePrecision');

/** Position on the scale in mm. Fit against the sight's scale is checked in the same transaction. */
const scaleValueMm = z.number();

export const markFields = {
  distanceM,
  scaleValueMm,
  note: optional(z.string().trim().max(200)),
  measuredAt: isoDateTime.optional(),
};

export const createMark = z.object({
  id: uuidv7,
  setupId: uuidv7,
  arrowSetId: uuidv7,
  ...markFields,
  /** Replace the mark at the same distance instead of failing with `SM-MARK-409-001`. */
  replace: z.boolean().default(false),
});
export type CreateMark = z.infer<typeof createMark>;

export const updateMark = z.object({ ...markFields, replace: z.boolean() }).partial();
export type UpdateMark = z.infer<typeof updateMark>;

export const mark = z.object({
  ...resourceFields,
  setupId: uuidv7,
  arrowSetId: uuidv7,
  distanceM,
  scaleValueMm,
  origin: z.enum(MARK_ORIGINS),
  note: optional(z.string().max(200)),
  measuredAt: isoDateTime,
});
export type Mark = z.infer<typeof mark>;

/** `GET /setups/:id/marks?arrowSetId=` returns the whole pair, capped at 500, unpaged. */
export const listMarksQuery = z.object({ arrowSetId: uuidv7 });
export type ListMarksQuery = z.infer<typeof listMarksQuery>;

export const MAX_MARKS_PER_PAIR = 500;
