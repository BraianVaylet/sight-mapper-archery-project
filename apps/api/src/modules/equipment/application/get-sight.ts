import type { ComponentUsage } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Sight, SightRepositories, SightUsagePort } from '../domain/sight.js';

export type GetSightDeps = { readonly sights: SightRepositories; readonly usage: SightUsagePort };

/** A sight and how much of the account leans on it. Not yours or not there: the same 404. */
export function createGetSight(deps: GetSightDeps) {
  return async function getSight(
    userId: string,
    id: string,
  ): Promise<{ sight: Sight; usage: ComponentUsage }> {
    const sight = await deps.sights.forUser(userId).find(id);
    if (sight === null) throw new AppError('SM-CORE-404-002', { resource: 'sight' });
    return { sight, usage: await deps.usage.sightUsage(userId, id) };
  };
}
