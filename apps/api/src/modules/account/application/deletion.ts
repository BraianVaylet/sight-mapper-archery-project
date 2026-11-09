import type { Locale } from '@sight-mapper/types';
import type { EventBus } from '../../../core/events/bus.js';
import { AppError } from '../../../core/http/errors.js';
import {
  purgeAtOf,
  type Clock,
  type Profile,
  type ProfileRepositories,
} from '../domain/profile.js';

const now = (deps: { readonly clock: Clock }) => deps.clock.now();

export type DeletionDeps = {
  readonly profiles: ProfileRepositories;
  readonly ensureProfile: (userId: string, locale: Locale) => Promise<Profile>;
  readonly clock: Clock;
  readonly bus: Pick<EventBus, 'publish'>;
};

/**
 * `POST /me/deletion-request` (HU-ACC-06): records the request. Nothing is removed now: the account
 * and everything in it go `DELETION_DAYS` later (the `purgeDeletedAccounts` job), and until then the
 * archer can still use the app, download their data, or change their mind. Asking twice is
 * `SM-ACC-409-001` and says when it will happen.
 */
export function createRequestDeletion(deps: DeletionDeps) {
  return async function requestDeletion(userId: string, fallbackLocale: Locale): Promise<Profile> {
    const profile = await deps.ensureProfile(userId, fallbackLocale);
    const already = (current: Profile) =>
      new AppError('SM-ACC-409-001', {
        purgeAt: purgeAtOf(current.deletionRequestedAt ?? deps.clock.now()).toString(),
      });
    if (profile.deletionRequestedAt !== null) throw already(profile);

    const updated = await deps.profiles
      .forUser(userId)
      .requestDeletion(profile.id, deps.clock.now());
    if (updated === null) {
      // Another request got there first.
      const current = await deps.ensureProfile(userId, fallbackLocale);
      throw already(current);
    }
    await deps.bus.publish('AccountDeletionRequested', { userId });
    return updated;
  };
}

/**
 * `DELETE /me/deletion-request`: withdraws it. `SM-ACC-404-001` when there is none. It takes no
 * `If-Match`: the way out of a deletion must work whatever else changed in the profile meanwhile.
 */
export function createCancelDeletion(deps: Omit<DeletionDeps, 'bus'>) {
  return async function cancelDeletion(userId: string, fallbackLocale: Locale): Promise<Profile> {
    const profile = await deps.ensureProfile(userId, fallbackLocale);
    if (profile.deletionRequestedAt === null) throw new AppError('SM-ACC-404-001');
    // Nobody else can have withdrawn it between the read and the write except the archer themselves.
    const updated = await deps.profiles.forUser(userId).cancelDeletion(profile.id, now(deps));
    if (updated === null) throw new AppError('SM-ACC-404-001');
    return updated;
  };
}
