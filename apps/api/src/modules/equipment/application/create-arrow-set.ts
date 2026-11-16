import type { CreateArrowSet } from '@sight-mapper/schemas';
import type { ArrowSet, ArrowSetRepositories } from '../domain/arrow-set.js';
import type { Clock } from '../domain/component.js';

export type CreateArrowSetDeps = {
  readonly arrowSets: ArrowSetRepositories;
  readonly clock: Clock;
};

/** A set needs only a short name: everything else is "leave blank what you did not measure". */
export function createCreateArrowSet(deps: CreateArrowSetDeps) {
  return async function createArrowSet(userId: string, input: CreateArrowSet): Promise<ArrowSet> {
    const now = deps.clock.now();
    const { id, ...fields } = input;
    const arrowSet: ArrowSet = {
      ...fields,
      id,
      userId,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await deps.arrowSets.forUser(userId).insert(arrowSet);
    return arrowSet;
  };
}
