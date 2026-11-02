import { AppError } from '../../../core/http/errors.js';
import type { Clock, SightRepositories, SightUsagePort } from '../domain/sight.js';

export type DeleteSightDeps = {
  readonly sights: SightRepositories;
  readonly usage: SightUsagePort;
  readonly clock: Clock;
};

/** Protected delete (ADR-008): a sight a setup uses is archived, not deleted (SM-SGT-409-001). */
export function createDeleteSight(deps: DeleteSightDeps) {
  return async function deleteSight(
    userId: string,
    id: string,
    expectedVersion: number,
  ): Promise<void> {
    const repository = deps.sights.forUser(userId);
    if ((await repository.find(id)) === null) {
      throw new AppError('SM-CORE-404-002', { resource: 'sight' });
    }
    const usage = await deps.usage.sightUsage(userId, id);
    if (usage.setups > 0) throw new AppError('SM-SGT-409-001', usage);
    await repository.softDelete(id, expectedVersion, deps.clock.now());
  };
}
