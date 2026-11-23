import { scaleBoundsMm, unitSizeMm, windageAxisScale } from '@sight-mapper/domain';
import type { SightScaleInput, UpdateSight, WindageScaleInput } from '@sight-mapper/schemas';
import type { ScaleChangeStrategy } from '@sight-mapper/types';
import { AppError } from '../../../core/http/errors.js';
import type { Transact } from '../../../core/db/transaction.js';
import type {
  Clock,
  ScaleChange,
  Sight,
  SightMarksPort,
  SightRepositories,
} from '../domain/sight.js';

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

/** A horizontal scale on the axis the vertical arithmetic works on (`right → down`, `left → up`). */
const onAxis = (scale: WindageScaleInput): SightScaleInput =>
  windageAxisScale({ ...scale, unitSizeMm: scale.unitSizeMm ?? null });

/** What one axis of the sight needs done to its marks, once every check has passed. */
type Rescale = ScaleChange & { readonly meaningChanged: boolean };

/**
 * HU-SGT-02, RN-SGT-05. A sight with marks whose scale changes in meaning needs to be told what
 * to keep (`keepReadings` or `keepPositions`, SM-SGT-409-003), and a change that leaves marks off
 * the scale is refused as a whole (SM-SGT-409-002). The vertical and the horizontal scale follow
 * the same rules, each on its own positions; adding a horizontal scale for the first time has no
 * marks to move. Nothing is written until every check passes.
 */
export function createUpdateSight(deps: UpdateSightDeps) {
  /** The checks of one axis; returns what to rescale in the transaction, if anything. */
  async function checkAxis(
    userId: string,
    sightId: string,
    from: SightScaleInput,
    to: SightScaleInput,
    strategy: ScaleChangeStrategy | undefined,
    axis: ScaleChange['axis'],
  ): Promise<Rescale | null> {
    const meaningChanged = scaleMeaningChanged(from, to);
    const rangeChanged = to.min !== from.min || to.max !== from.max;
    if (!meaningChanged && !rangeChanged) return null;

    const marks = await deps.marks.count(userId, sightId, axis);
    if (marks === 0) return null;
    if (meaningChanged && strategy === undefined) {
      throw new AppError('SM-SGT-409-003', { marks });
    }
    const change: ScaleChange = { from, to, strategy, axis };
    const outside = await deps.marks.countOutside(userId, sightId, change);
    if (outside > 0) {
      const { minMm, maxMm } = scaleBoundsMm({ ...to, unitSizeMm: to.unitSizeMm ?? null });
      throw new AppError('SM-SGT-409-002', { count: outside, minMm, maxMm });
    }
    return { ...change, meaningChanged };
  }

  return async function updateSight(
    userId: string,
    id: string,
    patch: UpdateSight,
    expectedVersion: number,
  ): Promise<Sight> {
    const repository = deps.sights.forUser(userId);
    const current = await repository.find(id);
    if (current === null) throw new AppError('SM-CORE-404-002', { resource: 'sight' });

    const { scaleChangeStrategy, windageScaleChangeStrategy, ...fields } = patch;
    const pending: Rescale[] = [];

    const vertical = await checkAxis(
      userId,
      id,
      current.scale,
      fields.scale ?? current.scale,
      scaleChangeStrategy,
      'vertical',
    );
    if (vertical !== null) pending.push(vertical);

    if (fields.windageScale !== undefined && current.windageScale !== null) {
      const windage = await checkAxis(
        userId,
        id,
        onAxis(current.windageScale),
        onAxis(fields.windageScale),
        windageScaleChangeStrategy,
        'windage',
      );
      if (windage !== null) pending.push(windage);
    }

    // The marks follow their scales, in the same transaction: a failure leaves all as it was.
    return deps.transact(async () => {
      const updated = await repository.update(id, fields, expectedVersion, deps.clock.now());
      for (const { meaningChanged, ...change } of pending) {
        if (meaningChanged) await deps.marks.rescale(userId, id, change);
      }
      return updated;
    });
  };
}
