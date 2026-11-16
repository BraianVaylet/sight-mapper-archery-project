import type { CreateSetup } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Clock, Setup, SetupRepositories } from '../domain/setup.js';
import type { CheckComponents } from './check-components.js';

export type CreateSetupDeps = {
  readonly setups: SetupRepositories;
  readonly check: CheckComponents;
  readonly clock: Clock;
};

/**
 * HU-STP-01. The three kinds of component must be the archer's own and active (`SM-STP-422-001`),
 * and the pair (bow, sight) must be free (`SM-STP-409-001`, with the setup that has it so the
 * screen can offer to add these arrows there instead).
 */
export function createCreateSetup(deps: CreateSetupDeps) {
  return async function createSetup(userId: string, input: CreateSetup): Promise<Setup> {
    await deps.check.bowAndSight(userId, input.bowId, input.sightId);
    await deps.check.arrowSets(userId, input.arrowSetIds);

    const repository = deps.setups.forUser(userId);
    const existing = await repository.findByPair(input.bowId, input.sightId);
    if (existing !== null) throw new AppError('SM-STP-409-001', { existingSetupId: existing.id });

    const now = deps.clock.now();
    const setup: Setup = {
      id: input.id,
      userId,
      ...(input.name == null ? {} : { name: input.name }),
      bowId: input.bowId,
      sightId: input.sightId,
      arrowSetIds: input.arrowSetIds,
      isFavorite: input.isFavorite,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await repository.insert(setup);
    return setup;
  };
}
