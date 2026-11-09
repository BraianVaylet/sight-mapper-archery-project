import type { CreateSight } from '@sight-mapper/schemas';
import type { Clock, Sight, SightRepositories } from '../domain/sight.js';

export type CreateSightDeps = { readonly sights: SightRepositories; readonly clock: Clock };

/** The scale rules (min < max, fixed unit sizes) are the shared schema's: it ran at the door. */
export function createCreateSight(deps: CreateSightDeps) {
  return async function createSight(userId: string, input: CreateSight): Promise<Sight> {
    const now = deps.clock.now();
    const { id, ...fields } = input;
    const sight: Sight = {
      ...fields,
      id,
      userId,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await deps.sights.forUser(userId).insert(sight);
    return sight;
  };
}
