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

/**
 * The archer's base tolerance of the Mark Doctor (RN-CAL-06, ADR-013): 1 to 10 mm in steps of 0.5.
 * Mirrors `DOCTOR_TOLERANCE_*` of the domain (this package does not depend on it). `null` = the
 * calibrated default, 4 mm.
 */
export const DOCTOR_TOLERANCE = { minMm: 1, maxMm: 10, stepMm: 0.5, defaultMm: 4 } as const;
export const doctorToleranceMm = z
  .number()
  .min(DOCTOR_TOLERANCE.minMm)
  .max(DOCTOR_TOLERANCE.maxMm)
  .multipleOf(DOCTOR_TOLERANCE.stepMm)
  .nullable();

const preferenceFields = {
  locale: z.enum(LOCALES),
  units,
  theme: z.enum(THEMES),
  doctorToleranceMm,
};

const notEmpty = (value: object) => Object.keys(value).length > 0;

/** `PATCH /me/preferences`: at least one preference, none required; `units` may carry one section. */
export const updatePreferences = z
  .object({
    locale: preferenceFields.locale,
    units: units.partial().refine(notEmpty, 'validation.preferences.empty'),
    theme: preferenceFields.theme,
    doctorToleranceMm,
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
  /** A profile read from an API older than F1-40 has none: the default. */
  doctorToleranceMm: doctorToleranceMm.default(null),
  quickAccess: quickAccess.nullable(),
  deletionRequestedAt: isoDateTime.nullable(),
  /** When a requested deletion is carried out: `deletionRequestedAt` + `DELETION_DAYS`. */
  purgeAt: isoDateTime.nullish(),
  version: z.int().min(1),
});
export type Profile = z.infer<typeof profile>;

/** Everything stored about an archer, in canonical units (RF-ACC-05, HU-ACC-05). */
/** 2: the profile carries `units` instead of a single `unitSystem` (F1-37) and `doctorToleranceMm` (F1-40). */
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
