import { scaleBoundsMm, unitSizeMm } from '@sight-mapper/domain';
import type { SightScaleInput } from '@sight-mapper/schemas';
import type { ScaleChangeStrategy } from '@sight-mapper/types';
import type { MarkRepositories } from '../domain/mark.js';
import type { Clock, SetupMarksPort, SetupRepositories } from '../domain/setup.js';

/** The marks of the setups, as the setup rules and the Home need them (the calculator's own port). */
export function createSetupMarks(deps: { marks: MarkRepositories }): SetupMarksPort {
  return {
    countBySetup: (userId, setupIds) => deps.marks.forUser(userId).countBySetup(setupIds),
    countForArrowSet: (userId, setupId, arrowSetId) =>
      deps.marks.forUser(userId).countForArrowSet(setupId, arrowSetId),
    trashBySetup: (userId, setupId, now) => deps.marks.forUser(userId).trashBySetup(setupId, now),
    restoreBySetup: (userId, setupId, now) =>
      deps.marks.forUser(userId).restoreBySetup(setupId, now),
  };
}

type ScaleChange = {
  readonly from: SightScaleInput;
  readonly to: SightScaleInput;
  readonly strategy: ScaleChangeStrategy | undefined;
};

const sizeOf = (scale: SightScaleInput) =>
  unitSizeMm({ unit: scale.unit, unitSizeMm: scale.unitSizeMm ?? null });

/**
 * What equipment may ask about the marks of a sight (its `SightMarksPort`, bridged in the
 * composition root). A mark lives in a setup and a setup in a sight, so the marks of a sight are
 * those of the live setups that use it.
 *
 * `keepReadings`: the number the archer wrote stays, so its position moves with the size of the
 * unit (`position × newSize / oldSize`). `keepPositions` (or no strategy, when only the range
 * changes): the position stays and the reading it stands for changes.
 */
export function createSightMarks(deps: {
  setups: SetupRepositories;
  marks: MarkRepositories;
  clock: Clock;
}) {
  const setupIdsOf = (userId: string, sightId: string) =>
    deps.setups.forUser(userId).idsUsing('sight', sightId);

  /** Factor that takes an old position to its new one under the chosen strategy. */
  const factorOf = ({ from, to, strategy }: ScaleChange): number =>
    strategy === 'keepReadings' ? sizeOf(to) / sizeOf(from) : 1;

  return {
    async count(userId: string, sightId: string): Promise<number> {
      const ids = await setupIdsOf(userId, sightId);
      const counts = await deps.marks.forUser(userId).countBySetup(ids);
      return [...counts.values()].reduce((sum, n) => sum + n, 0);
    },

    async countOutside(userId: string, sightId: string, change: ScaleChange): Promise<number> {
      const ids = await setupIdsOf(userId, sightId);
      const positions = await deps.marks.forUser(userId).positionsOf(ids);
      const factor = factorOf(change);
      const { minMm, maxMm } = scaleBoundsMm({
        ...change.to,
        unitSizeMm: change.to.unitSizeMm ?? null,
      });
      return positions.filter((p) => p * factor < minMm || p * factor > maxMm).length;
    },

    async rescale(userId: string, sightId: string, change: ScaleChange): Promise<void> {
      const factor = factorOf(change);
      if (factor === 1) return;
      const ids = await setupIdsOf(userId, sightId);
      await deps.marks.forUser(userId).scalePositions(ids, factor, deps.clock.now());
    },
  };
}
