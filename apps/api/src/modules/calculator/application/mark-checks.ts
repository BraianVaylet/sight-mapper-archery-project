import { Temporal } from '@js-temporal/polyfill';
import { scaleBoundsMm } from '@sight-mapper/domain';
import { AppError } from '../../../core/http/errors.js';
import type { Mark } from '../domain/mark.js';
import type { Clock, EquipmentReadPort, Setup, SetupRepositories } from '../domain/setup.js';

/** A device clock a few minutes fast is not a future mark (DICCIONARIO §3.5). */
export const MEASURED_AT_TOLERANCE_MINUTES = 5;

export type MarkChecksDeps = {
  readonly setups: SetupRepositories;
  readonly equipment: EquipmentReadPort;
  readonly clock: Clock;
};

/**
 * The rules every write of a mark shares (RN-MRK-02, RN-MRK-03, measuredAt not in the future):
 * which setup it lives in, whether its arrow set belongs there, whether the reading is on the
 * scale of the sight, and whether the date is believable.
 */
export function createMarkChecks(deps: MarkChecksDeps) {
  return {
    /** The live setup of this archer: not theirs or in the trash is the same 404. */
    async setupOf(userId: string, setupId: string): Promise<Setup> {
      const setup = await deps.setups.forUser(userId).find(setupId);
      if (setup === null) throw new AppError('SM-CORE-404-002', { resource: 'setup' });
      return setup;
    },

    /** RN-MRK-03 */
    arrowSetBelongs(setup: Setup, arrowSetId: string): void {
      if (!setup.arrowSetIds.includes(arrowSetId)) {
        throw new AppError('SM-MARK-422-002', { arrowSetId });
      }
    },

    /** RN-MRK-02: the position must lie within the scale of the sight, read at this moment. */
    async onScale(userId: string, setup: Setup, scaleValueMm: number): Promise<void> {
      const [sight] = await deps.equipment.sights(userId, [setup.sightId]);
      if (sight === undefined) {
        throw new AppError('SM-STP-422-001', { kind: 'sight', id: setup.sightId });
      }
      const { minMm, maxMm } = scaleBoundsMm({
        ...sight.scale,
        unitSizeMm: sight.scale.unitSizeMm ?? null,
      });
      if (scaleValueMm < minMm || scaleValueMm > maxMm) {
        throw new AppError('SM-MARK-422-001', { minMm, maxMm });
      }
    },

    /** `measuredAt` defaults to now, and cannot be later than now plus the tolerance. */
    measuredAt(requested: Temporal.Instant | undefined): Temporal.Instant {
      const now = deps.clock.now();
      if (requested === undefined) return now;
      if (
        Temporal.Instant.compare(requested, now.add({ minutes: MEASURED_AT_TOLERANCE_MINUTES })) > 0
      ) {
        throw new AppError('SM-CORE-400-001', {
          issues: [
            { path: ['measuredAt'], messageKey: 'validation.mark.measuredAtFuture', params: {} },
          ],
        });
      }
      return requested;
    },
  };
}

export type MarkChecks = ReturnType<typeof createMarkChecks>;

/** The conflict of RN-MRK-04: there is already a mark at that distance. */
export const duplicateDistance = (existing: Mark) =>
  new AppError('SM-MARK-409-001', { existingMarkId: existing.id, distanceM: existing.distanceM });
