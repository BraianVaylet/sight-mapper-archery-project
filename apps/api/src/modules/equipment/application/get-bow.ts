import type { ComponentUsage } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Bow, BowRepositories, ComponentUsagePort } from '../domain/bow.js';

export type GetBowDeps = { readonly bows: BowRepositories; readonly usage: ComponentUsagePort };

/** A bow and how much of the account leans on it. Not yours or not there: the same 404. */
export function createGetBow(deps: GetBowDeps) {
  return async function getBow(
    userId: string,
    id: string,
  ): Promise<{ bow: Bow; usage: ComponentUsage }> {
    const bow = await deps.bows.forUser(userId).find(id);
    if (bow === null) throw new AppError('SM-CORE-404-002', { resource: 'bow' });
    return { bow, usage: await deps.usage.bowUsage(userId, id) };
  };
}
