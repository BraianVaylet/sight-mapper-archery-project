import type { Locale } from '@sight-mapper/types';
import {
  defaultPreferences,
  type Clock,
  type Profile,
  type ProfileRepositories,
} from '../domain/profile.js';

export type EnsureProfileDeps = {
  readonly profiles: ProfileRepositories;
  readonly newId: () => string;
  readonly clock: Clock;
};

/**
 * Makes sure an archer has a profile, creating it with defaults from their language. Idempotent:
 * called on `UserRegistered` and again, lazily, wherever a profile is needed, so a failure at
 * sign-up (or a user that signed up before profiles existed) heals itself.
 */
export function createEnsureProfile(deps: EnsureProfileDeps) {
  return async function ensureProfile(userId: string, locale: Locale): Promise<Profile> {
    const repository = deps.profiles.forUser(userId);
    const existing = await repository.findOwn();
    if (existing !== null) return existing;

    const now = deps.clock.now();
    const profile: Profile = {
      id: deps.newId(),
      userId,
      ...defaultPreferences(locale),
      quickAccess: null,
      deletionRequestedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (await repository.insert(profile)) return profile;

    // Lost a race with a concurrent call: the other one's profile is the profile.
    const winner = await repository.findOwn();
    if (winner === null) throw new Error('Profile vanished after a duplicate-key insert');
    return winner;
  };
}
