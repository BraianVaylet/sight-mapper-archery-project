import { scaleBoundsMm, unitSizeMm } from '@sight-mapper/domain';
import type { SightScaleInput, UpdateSight } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Transact } from '../../../core/db/transaction.js';
import type { Clock, Sight, SightMarksPort, SightRepositories } from '../domain/sight.js';

export type UpdateSightDeps = {
  readonly sights: SightRepositories;
  readonly marks: SightMarksPort;
  readonly clock: Clock;
  /** The sight and its marks change together or not at all. */
  readonly transact: Transact;
};

/**
 * Readings change meaning when the unit or its size changes (a reading of 3 in `cm` is not a
 * reading of 3 in `custom` of 8 mm). Range, resolution and direction do not.
 */
export function scaleMeaningChanged(from: SightScaleInput, to: SightScaleInput): boolean {
  const size = (scale: SightScaleInput) =>
    unitSizeMm({ unit: scale.unit, unitSizeMm: scale.unitSizeMm ?? null });
  return from.unit !== to.unit || size(from) !== size(to);
}

/**
 * HU-SGT-02. A sight with marks whose scale changes in meaning needs to be told what to keep
 * (`keepReadings` or `keepPositions`, SM-SGT-409-003), and a change that leaves marks off the
 * scale is refused as a whole (SM-SGT-409-002). Nothing is written until both pass.
 */
export function createUpdateSight(deps: UpdateSightDeps) {
  return async function updateSight(
    userId: string,
    id: string,
    patch: UpdateSight,
    expectedVersion: number,
  ): Promise<Sight> {
    const repository = deps.sights.forUser(userId);
    const current = await repository.find(id);
    if (current === null) throw new AppError('SM-CORE-404-002', { resource: 'sight' });

    const { scaleChangeStrategy, ...fields } = patch;
    const next = fields.scale ?? current.scale;
    const meaningChanged = scaleMeaningChanged(current.scale, next);
    const rangeChanged = next.min !== current.scale.min || next.max !== current.scale.max;

    const marks = meaningChanged || rangeChanged ? await deps.marks.count(userId, id) : 0;
    if (marks > 0) {
      if (meaningChanged && scaleChangeStrategy === undefined) {
        throw new AppError('SM-SGT-409-003', { marks });
      }
      const change = { from: current.scale, to: next, strategy: scaleChangeStrategy };
      const outside = await deps.marks.countOutside(userId, id, change);
      if (outside > 0) {
        const { minMm, maxMm } = scaleBoundsMm({ ...next, unitSizeMm: next.unitSizeMm ?? null });
        throw new AppError('SM-SGT-409-002', { count: outside, minMm, maxMm });
      }
    }

    // The marks follow the scale, in the same transaction: a failure leaves both as they were.
    return deps.transact(async () => {
      const updated = await repository.update(id, fields, expectedVersion, deps.clock.now());
      if (marks > 0 && meaningChanged) {
        await deps.marks.rescale(userId, id, {
          from: current.scale,
          to: next,
          strategy: scaleChangeStrategy,
        });
      }
      return updated;
    });
  };
}
