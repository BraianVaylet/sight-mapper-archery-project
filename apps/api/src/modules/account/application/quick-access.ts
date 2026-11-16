import type { Locale } from '@sight-mapper/types';
import { AppError } from '../../../core/http/errors.js';
import type {
  Clock,
  Profile,
  ProfileRepositories,
  QuickAccess,
  SetupLookupPort,
} from '../domain/profile.js';

export type QuickAccessDeps = {
  readonly profiles: ProfileRepositories;
  readonly ensureProfile: (userId: string, locale: Locale) => Promise<Profile>;
  readonly setups: SetupLookupPort;
  readonly clock: Clock;
};

/**
 * `PUT /me/quick-access` (HU-STP-03): the setup and arrow set the app opens on, or `null` to
 * clear it. The setup has to be a live one of this archer (404 otherwise: another archer's is
 * indistinguishable from none, ADR-000) and the arrow set one of its own (`SM-ACC-422-001`).
 */
export function createSetQuickAccess(deps: QuickAccessDeps) {
  return async function setQuickAccess(
    userId: string,
    fallbackLocale: Locale,
    quickAccess: QuickAccess | null,
    expectedVersion: number,
  ): Promise<Profile> {
    const profile = await deps.ensureProfile(userId, fallbackLocale);
    if (quickAccess !== null) {
      const arrowSetIds = await deps.setups.arrowSetIdsOf(userId, quickAccess.setupId);
      if (arrowSetIds === null) throw new AppError('SM-CORE-404-002', { resource: 'setup' });
      if (!arrowSetIds.includes(quickAccess.arrowSetId)) throw new AppError('SM-ACC-422-001');
    }
    return deps.profiles
      .forUser(userId)
      .setQuickAccess(profile.id, quickAccess, expectedVersion, deps.clock.now());
  };
}

/** RN-STP-07: when a setup is deleted, a quick access that pointed at it is cleared. */
export function createClearQuickAccessOfSetup(deps: {
  readonly profiles: ProfileRepositories;
  readonly clock: Clock;
}) {
  return async function clearQuickAccessOfSetup(userId: string, setupId: string): Promise<boolean> {
    return deps.profiles.forUser(userId).clearQuickAccessOf(setupId, deps.clock.now());
  };
}
