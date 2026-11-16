import type { ArrowSetRef, BowRef, SightRef } from '@sight-mapper/schemas';
import type { ArrowSetRepositories } from '../domain/arrow-set.js';
import type { BowRepositories } from '../domain/bow.js';
import type { SightRepositories } from '../domain/sight.js';

export type EquipmentReaderDeps = {
  readonly bows: BowRepositories;
  readonly sights: SightRepositories;
  readonly arrowSets: ArrowSetRepositories;
};

/**
 * What other modules may know about an archer's equipment (the calculator's `EquipmentReadPort`,
 * wired in the composition root): who each component is and whether it can still be chosen.
 * Only this archer's components come back; one that is not theirs, or not there, is just missing.
 */
export function createEquipmentReader(deps: EquipmentReaderDeps) {
  return {
    async bows(userId: string, ids: readonly string[]): Promise<BowRef[]> {
      const found = await deps.bows.forUser(userId).findMany(ids);
      return found.map((bow) => ({
        id: bow.id,
        status: bow.status,
        ...(bow.nickname == null ? {} : { nickname: bow.nickname }),
        ...(bow.manufacturer == null ? {} : { manufacturer: bow.manufacturer }),
        ...(bow.model == null ? {} : { model: bow.model }),
      }));
    },

    async sights(userId: string, ids: readonly string[]): Promise<SightRef[]> {
      const found = await deps.sights.forUser(userId).findMany(ids);
      return found.map((sight) => ({
        id: sight.id,
        status: sight.status,
        pinType: sight.pinType,
        scale: sight.scale,
        ...(sight.nickname == null ? {} : { nickname: sight.nickname }),
        ...(sight.manufacturer == null ? {} : { manufacturer: sight.manufacturer }),
        ...(sight.model == null ? {} : { model: sight.model }),
      }));
    },

    async arrowSets(userId: string, ids: readonly string[]): Promise<ArrowSetRef[]> {
      const found = await deps.arrowSets.forUser(userId).findMany(ids);
      return found.map((set) => ({ id: set.id, status: set.status, name: set.name }));
    },
  };
}
