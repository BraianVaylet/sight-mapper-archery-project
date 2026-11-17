import { LOCALES, THEMES, UNIT_SYSTEMS } from '@sight-mapper/types';
import { z } from 'zod';
import { isoDateTime, uuidv7 } from './common.js';

const unitSystem = z.enum(UNIT_SYSTEMS);

/**
 * The unit system of each section (RF-ACC-04): `marks` is distances only (readings stay in the
 * scale of each sight), `bow` and `arrows` their forms, `sight` the scale unit a new sight starts on.
 */
export const units = z.object({
  marks: unitSystem,
  bow: unitSystem,
  arrows: unitSystem,
  sight: unitSystem,
});
export type Units = z.infer<typeof units>;

/** What a new archer starts with: distances metric, equipment in the units of the trade. */
export const DEFAULT_UNITS: Units = {
  marks: 'metric',
  bow: 'imperial',
  arrows: 'imperial',
  sight: 'metric',
};

const preferenceFields = {
  locale: z.enum(LOCALES),
  units,
  theme: z.enum(THEMES),
};

const notEmpty = (value: object) => Object.keys(value).length > 0;

/** `PATCH /me/preferences`: at least one preference, none required; `units` may carry one section. */
export const updatePreferences = z
  .object({
    locale: preferenceFields.locale,
    units: units.partial().refine(notEmpty, 'validation.preferences.empty'),
    theme: preferenceFields.theme,
  })
  .partial()
  .refine(notEmpty, 'validation.preferences.empty');
export type UpdatePreferences = z.infer<typeof updatePreferences>;

/** The pair the app opens on start. Whether the arrow set belongs to the setup is a use-case rule. */
export const quickAccess = z.object({ setupId: uuidv7, arrowSetId: uuidv7 });
export type QuickAccess = z.infer<typeof quickAccess>;

/** `PUT /me/quick-access`: a pair, or `null` to clear it. */
export const putQuickAccess = quickAccess.nullable();
export type PutQuickAccess = z.infer<typeof putQuickAccess>;

/** A requested deletion is carried out this many days later, and can be cancelled until then (RF-ACC-06). */
export const DELETION_DAYS = 90;

export const profile = z.object({
  ...preferenceFields,
  quickAccess: quickAccess.nullable(),
  deletionRequestedAt: isoDateTime.nullable(),
  /** When a requested deletion is carried out: `deletionRequestedAt` + `DELETION_DAYS`. */
  purgeAt: isoDateTime.nullish(),
  version: z.int().min(1),
});
export type Profile = z.infer<typeof profile>;

/** Everything stored about an archer, in canonical units (RF-ACC-05, HU-ACC-05). */
/** 2: the profile carries `units` instead of a single `unitSystem` (F1-37). */
export const EXPORT_SCHEMA_VERSION = 2;
const exportedRows = z.array(z.record(z.string(), z.unknown()));
export const accountExport = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: isoDateTime,
  profile: z.object({
    ...preferenceFields,
    quickAccess: quickAccess.nullable(),
    deletionRequestedAt: isoDateTime.nullable(),
  }),
  bows: exportedRows,
  sights: exportedRows,
  arrowSets: exportedRows,
  setups: exportedRows,
  marks: exportedRows,
});
export type AccountExport = z.infer<typeof accountExport>;
