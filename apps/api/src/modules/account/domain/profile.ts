import type { Temporal } from '@js-temporal/polyfill';
import { DEFAULT_UNITS, DELETION_DAYS, type Units } from '@sight-mapper/schemas';
import type { Locale, Theme, UnitSystem } from '@sight-mapper/types';

export type Profile = {
  readonly id: string;
  readonly userId: string;
  readonly locale: Locale;
  /** One system per section (RF-ACC-04). */
  readonly units: Units;
  readonly theme: Theme;
  readonly quickAccess: { readonly setupId: string; readonly arrowSetId: string } | null;
  readonly deletionRequestedAt: Temporal.Instant | null;
  readonly version: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
};

/**
 * A new archer's language comes from their browser (DICCIONARIO §3.6); the units are the same for
 * everyone (RF-ACC-04): distances metric, bow and arrows imperial, a new sight in mm. All of it is
 * changed in Settings.
 */
export function defaultPreferences(locale: Locale): Preferences {
  return { locale, units: { ...DEFAULT_UNITS }, theme: 'system' };
}

export type Preferences = Pick<Profile, 'locale' | 'units' | 'theme'>;

/**
 * What a PATCH may carry: any preference, each optional, and any section of the units. An absent
 * one is not touched.
 */
export type PreferencesPatch = {
  locale?: Locale | undefined;
  theme?: Theme | undefined;
  units?: { [K in keyof Units]?: UnitSystem | undefined } | undefined;
};

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
  /** Records the request for deletion; `null` when there already is one (the condition is in the write). */
  requestDeletion(id: string, now: Temporal.Instant): Promise<Profile | null>;
  /** Withdraws the request, if there is one; `null` when there is none. Bumps the version. */
  cancelDeletion(id: string, now: Temporal.Instant): Promise<Profile | null>;
  /** Clears the quick access if it points at this setup; `true` when it did. Idempotent. */
  clearQuickAccessOf(setupId: string, now: Temporal.Instant): Promise<boolean>;
};

/** When a requested deletion is carried out (RF-ACC-06): `DELETION_DAYS` after the request. */
export const purgeAtOf = (requestedAt: Temporal.Instant): Temporal.Instant =>
  requestedAt.add({ hours: DELETION_DAYS * 24 });

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
