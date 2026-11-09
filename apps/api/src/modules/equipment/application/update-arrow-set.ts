import type { UpdateArrowSet } from '@sight-mapper/schemas';
import type { ArrowSet, ArrowSetRepositories } from '../domain/arrow-set.js';
import type { Clock } from '../domain/component.js';

export type UpdateArrowSetDeps = {
  readonly arrowSets: ArrowSetRepositories;
  readonly clock: Clock;
};

/** `null` clears a field, absent keeps it; the version in `If-Match` must be the current one. */
export function createUpdateArrowSet(deps: UpdateArrowSetDeps) {
  return function updateArrowSet(
    userId: string,
    id: string,
    patch: UpdateArrowSet,
    expectedVersion: number,
  ): Promise<ArrowSet> {
    return deps.arrowSets.forUser(userId).update(id, patch, expectedVersion, deps.clock.now());
  };
}
