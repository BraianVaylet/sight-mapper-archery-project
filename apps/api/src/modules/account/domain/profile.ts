import type { Temporal } from '@js-temporal/polyfill';
import type { Locale, Theme, UnitSystem } from '@sight-mapper/types';

export type Profile = {
  readonly id: string;
  readonly userId: string;
  readonly locale: Locale;
  readonly unitSystem: UnitSystem;
  readonly theme: Theme;
  readonly quickAccess: { readonly setupId: string; readonly arrowSetId: string } | null;
  readonly deletionRequestedAt: Temporal.Instant | null;
  readonly version: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
};

/**
 * A new archer's preferences come from the language of their browser (DICCIONARIO §3.6): Spanish
 * speakers get metres, English speakers yards. They can change both in Appearance.
 */
export function defaultPreferences(
  locale: Locale,
): Pick<Profile, 'locale' | 'unitSystem' | 'theme'> {
  return { locale, unitSystem: locale === 'es' ? 'metric' : 'imperial', theme: 'system' };
}

/** Reads and writes the profile of one archer: the user id is fixed when the repository is made. */
export type ProfileRepository = {
  findOwn(): Promise<Profile | null>;
  /** Returns `false` when this archer already has a profile (the unique index said so). */
  insert(profile: Profile): Promise<boolean>;
};

export type ProfileRepositories = { forUser(userId: string): ProfileRepository };

export type Clock = { now(): Temporal.Instant };
