import { AppError } from '../../../core/http/errors.js';
import type { BowRepositories, Clock, ComponentUsagePort } from '../domain/bow.js';

export type DeleteBowDeps = {
  readonly bows: BowRepositories;
  readonly usage: ComponentUsagePort;
  readonly clock: Clock;
};

/**
 * Protected delete (ADR-008): a bow a setup uses is not deleted, it is archived. The answer says
 * how many setups and marks lean on it so the screen can offer "Archivar".
 */
export function createDeleteBow(deps: DeleteBowDeps) {
  return async function deleteBow(
    userId: string,
    id: string,
    expectedVersion: number,
  ): Promise<void> {
    const repository = deps.bows.forUser(userId);
    if ((await repository.find(id)) === null) {
      throw new AppError('SM-CORE-404-002', { resource: 'bow' });
    }
    const usage = await deps.usage.bowUsage(userId, id);
    if (usage.setups > 0) throw new AppError('SM-BOW-409-001', usage);
    await repository.softDelete(id, expectedVersion, deps.clock.now());
  };
}
