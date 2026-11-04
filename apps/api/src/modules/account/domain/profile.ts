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

export type Preferences = Pick<Profile, 'locale' | 'unitSystem' | 'theme'>;

/** What a PATCH may carry: any preference, each optional. An absent one is not touched. */
export type PreferencesPatch = { [K in keyof Preferences]?: Preferences[K] | undefined };

/** Reads and writes the profile of one archer: the user id is fixed when the repository is made. */
export type ProfileRepository = {
  findOwn(): Promise<Profile | null>;
  /** Returns `false` when this archer already has a profile (the unique index said so). */
  insert(profile: Profile): Promise<boolean>;
  /**
   * Changes only the given preferences, if the profile is still at `expectedVersion`: a stale
   * version is `SM-CORE-412-001`, never a silent overwrite.
   */
  updatePreferences(
    id: string,
    patch: PreferencesPatch,
    expectedVersion: number,
    now: Temporal.Instant,
  ): Promise<Profile>;
  /** Sets or clears the quick access, if the profile is still at `expectedVersion` (`SM-CORE-412-001`). */
  setQuickAccess(
    id: string,
    quickAccess: QuickAccess | null,
    expectedVersion: number,
    now: Temporal.Instant,
  ): Promise<Profile>;
  /** Clears the quick access if it points at this setup; `true` when it did. Idempotent. */
  clearQuickAccessOf(setupId: string, now: Temporal.Instant): Promise<boolean>;
};

/** The pair the app opens on start (RN-STP-07: at most one per archer). */
export type QuickAccess = NonNullable<Profile['quickAccess']>;

/**
 * Declared here, implemented by the calculator through the composition root: the account module
 * only needs to know which arrow sets a live setup of this archer has. `null` when there is no
 * such setup (not theirs, not there, or in the trash).
 */
export type SetupLookupPort = {
  arrowSetIdsOf(userId: string, setupId: string): Promise<readonly string[] | null>;
};

export type ProfileRepositories = { forUser(userId: string): ProfileRepository };

export type Clock = { now(): Temporal.Instant };
