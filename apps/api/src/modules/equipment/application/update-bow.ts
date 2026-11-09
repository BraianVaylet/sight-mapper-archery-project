import type { UpdateBow } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Bow, BowRepositories, Clock } from '../domain/bow.js';

export type UpdateBowDeps = { readonly bows: BowRepositories; readonly clock: Clock };

/** What the bow would look like after the patch: `null` clears, absent keeps. */
const after = <K extends 'manufacturer' | 'model'>(
  patch: UpdateBow,
  current: Bow,
  key: K,
): string | null | undefined => (patch[key] === undefined ? current[key] : patch[key]);

export function createUpdateBow(deps: UpdateBowDeps) {
  return async function updateBow(
    userId: string,
    id: string,
    patch: UpdateBow,
    expectedVersion: number,
  ): Promise<Bow> {
    const repository = deps.bows.forUser(userId);
    const current = await repository.find(id);
    if (current === null) throw new AppError('SM-CORE-404-002', { resource: 'bow' });

    if (patch.bowType !== undefined && patch.bowType !== 'compound') {
      throw new AppError('SM-BOW-422-001', { bowType: patch.bowType });
    }
    // A bow keeps a name: clearing both the manufacturer and the model leaves nothing to call it.
    if (!after(patch, current, 'manufacturer') && !after(patch, current, 'model')) {
      throw new AppError('SM-CORE-400-001', {
        issues: [
          {
            path: ['manufacturer'],
            messageKey: 'validation.equipment.manufacturerOrModel',
            params: {},
          },
        ],
      });
    }
    return repository.update(id, patch, expectedVersion, deps.clock.now());
  };
}
