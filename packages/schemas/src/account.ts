import { LOCALES, THEMES, UNIT_SYSTEMS } from '@sight-mapper/types';
import { z } from 'zod';
import { isoDateTime, uuidv7 } from './common.js';

const preferenceFields = {
  locale: z.enum(LOCALES),
  unitSystem: z.enum(UNIT_SYSTEMS),
  theme: z.enum(THEMES),
};

/** `PATCH /me/preferences`: at least one preference, none required. */
export const updatePreferences = z
  .object(preferenceFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'validation.preferences.empty');
export type UpdatePreferences = z.infer<typeof updatePreferences>;

/** The pair the app opens on start. Whether the arrow set belongs to the setup is a use-case rule. */
export const quickAccess = z.object({ setupId: uuidv7, arrowSetId: uuidv7 });
export type QuickAccess = z.infer<typeof quickAccess>;

/** `PUT /me/quick-access`: a pair, or `null` to clear it. */
export const putQuickAccess = quickAccess.nullable();
export type PutQuickAccess = z.infer<typeof putQuickAccess>;

export const profile = z.object({
  ...preferenceFields,
  quickAccess: quickAccess.nullable(),
  deletionRequestedAt: isoDateTime.nullable(),
  version: z.int().min(1),
});
export type Profile = z.infer<typeof profile>;
