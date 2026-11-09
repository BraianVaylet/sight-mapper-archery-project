import type { Locale } from '@sight-mapper/types';
import type { Clock, PreferencesPatch, Profile, ProfileRepositories } from '../domain/profile.js';

export type UpdatePreferencesDeps = {
  readonly profiles: ProfileRepositories;
  readonly ensureProfile: (userId: string, locale: Locale) => Promise<Profile>;
  readonly clock: Clock;
};

/**
 * `PATCH /me/preferences`: changes the preferences the archer sent and nothing else. The profile
 * is created first when it is missing (it heals a sign-up whose event failed), and the write only
 * lands if the archer saw the latest version.
 */
export function createUpdatePreferences(deps: UpdatePreferencesDeps) {
  return async function updatePreferences(
    userId: string,
    fallbackLocale: Locale,
    patch: PreferencesPatch,
    expectedVersion: number,
  ): Promise<Profile> {
    const profile = await deps.ensureProfile(userId, fallbackLocale);
    return deps.profiles
      .forUser(userId)
      .updatePreferences(profile.id, patch, expectedVersion, deps.clock.now());
  };
}
