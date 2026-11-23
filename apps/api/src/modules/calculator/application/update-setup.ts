import { scaleBoundsMm, windageAxisScale } from '@sight-mapper/domain';
import type { UpdateSetup } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type {
  Clock,
  EquipmentReadPort,
  Setup,
  SetupMarksPort,
  SetupRepositories,
} from '../domain/setup.js';
import type { CheckComponents } from './check-components.js';

export type UpdateSetupDeps = {
  readonly setups: SetupRepositories;
  readonly marks: SetupMarksPort;
  readonly check: CheckComponents;
  readonly equipment: EquipmentReadPort;
  readonly clock: Clock;
};

/**
 * Name, favourite and arrow sets. The bow and the sight never change. Adding an arrow set needs it
 * to be the archer's and active (`SM-STP-422-001`); taking one away that has marks is refused
 * (`SM-STP-409-002`, RN-STP-05); a setup cannot be left with none (`SM-STP-422-002`). The base
 * windage (RN-STP-08) needs a horizontal scale on the sight (`SM-STP-422-003`) and must lie within
 * it (`SM-STP-422-004`).
 */
export function createUpdateSetup(deps: UpdateSetupDeps) {
  return async function updateSetup(
    userId: string,
    id: string,
    patch: UpdateSetup,
    expectedVersion: number,
  ): Promise<Setup> {
    const repository = deps.setups.forUser(userId);
    const current = await repository.find(id);
    if (current === null) throw new AppError('SM-CORE-404-002', { resource: 'setup' });

    if (patch.arrowSetIds !== undefined) {
      if (patch.arrowSetIds.length === 0) throw new AppError('SM-STP-422-002');
      const wanted = new Set(patch.arrowSetIds);
      const had = new Set(current.arrowSetIds);

      await deps.check.arrowSets(
        userId,
        patch.arrowSetIds.filter((arrowSetId) => !had.has(arrowSetId)),
      );
      for (const arrowSetId of current.arrowSetIds.filter((value) => !wanted.has(value))) {
        const marks = await deps.marks.countForArrowSet(userId, id, arrowSetId);
        if (marks > 0) throw new AppError('SM-STP-409-002', { arrowSetId, marks });
      }
    }
    if (typeof patch.windageMm === 'number') {
      const [sight] = await deps.equipment.sights(userId, [current.sightId]);
      if (sight === undefined) {
        throw new AppError('SM-STP-422-001', { kind: 'sight', id: current.sightId });
      }
      if (sight.windageScale === null) throw new AppError('SM-STP-422-003', {});
      const { minMm, maxMm } = scaleBoundsMm(
        windageAxisScale({
          ...sight.windageScale,
          unitSizeMm: sight.windageScale.unitSizeMm ?? null,
        }),
      );
      if (patch.windageMm < minMm || patch.windageMm > maxMm) {
        throw new AppError('SM-STP-422-004', { minMm, maxMm });
      }
    }
    return repository.update(id, patch, expectedVersion, deps.clock.now());
  };
}
