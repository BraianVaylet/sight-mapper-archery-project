import type { ComponentStatus } from '@sight-mapper/types';
import type { Bow, BowRepositories, Clock } from '../domain/bow.js';

export type ChangeBowStatusDeps = { readonly bows: BowRepositories; readonly clock: Clock };

/**
 * `archive` and `unarchive` (ADR-008): the only ways a bow's status changes. Idempotent, so it
 * needs no `If-Match`: archiving an archived bow answers the bow as it is.
 */
export function createChangeBowStatus(deps: ChangeBowStatusDeps) {
  return function changeBowStatus(
    userId: string,
    id: string,
    status: ComponentStatus,
  ): Promise<Bow> {
    return deps.bows.forUser(userId).setStatus(id, status, deps.clock.now());
  };
}
