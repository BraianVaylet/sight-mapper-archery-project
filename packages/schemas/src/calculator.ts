import { MARK_ORIGINS, PIN_TYPES } from '@sight-mapper/types';
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
import { sightScale } from './equipment.js';

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

// ------------------------------------------------- setups as the app reads them

/** How a component is shown inside a setup. `status` lets a card say "arco archivado". */
const refStatus = { id: uuidv7, status: componentStatus };
const refNames = {
  nickname: optional(text(1, 40)),
  manufacturer: optional(text(1, 60)),
  model: optional(text(1, 60)),
};

export const bowRef = z.object({ ...refStatus, ...refNames });
export type BowRef = z.infer<typeof bowRef>;

export const sightRef = z.object({
  ...refStatus,
  ...refNames,
  pinType: z.enum(PIN_TYPES),
  scale: sightScale,
});
export type SightRef = z.infer<typeof sightRef>;

export const arrowSetRef = z.object({ ...refStatus, name: z.string() });
export type ArrowSetRef = z.infer<typeof arrowSetRef>;

/** A setup with its bow, sight (with its scale) and arrow sets, and how many marks it holds. */
export const setupView = setup.extend({
  bow: bowRef,
  sight: sightRef,
  arrowSets: z.array(arrowSetRef),
  marksCount: z.int().min(0),
});
export type SetupView = z.infer<typeof setupView>;

/** A setup in the trash: when it will be purged for good (30 days after it was deleted). */
export const trashedSetupView = setupView.extend({ purgeAt: isoDateTime });
export type TrashedSetupView = z.infer<typeof trashedSetupView>;

export const TRASH_DAYS = 30;
