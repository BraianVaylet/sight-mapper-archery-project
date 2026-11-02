import type { ComponentStatus } from '@sight-mapper/types';
import type { Clock, Sight, SightRepositories } from '../domain/sight.js';

export type ChangeSightStatusDeps = { readonly sights: SightRepositories; readonly clock: Clock };

/** `archive` and `unarchive` (ADR-008): the only ways a sight's status changes. Idempotent. */
export function createChangeSightStatus(deps: ChangeSightStatusDeps) {
  return function changeSightStatus(
    userId: string,
    id: string,
    status: ComponentStatus,
  ): Promise<Sight> {
    return deps.sights.forUser(userId).setStatus(id, status, deps.clock.now());
  };
}
