import { AppError } from '../../../core/http/errors.js';
import type { EquipmentReadPort } from '../domain/setup.js';

/**
 * RN-STP-04: a setup is built only from the archer's own, active components. One that is not
 * theirs, does not exist or is archived is the same answer (`SM-STP-422-001`), and the first
 * offender is named so the form can mark that select.
 */
export function createCheckComponents(equipment: EquipmentReadPort) {
  const unavailable = (kind: string, id: string) => new AppError('SM-STP-422-001', { kind, id });

  return {
    async bowAndSight(userId: string, bowId: string, sightId: string): Promise<void> {
      const [bows, sights] = await Promise.all([
        equipment.bows(userId, [bowId]),
        equipment.sights(userId, [sightId]),
      ]);
      if (bows.find((b) => b.id === bowId)?.status !== 'active') throw unavailable('bow', bowId);
      if (sights.find((s) => s.id === sightId)?.status !== 'active') {
        throw unavailable('sight', sightId);
      }
    },

    async arrowSets(userId: string, ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      const found = await equipment.arrowSets(userId, ids);
      for (const id of ids) {
        if (found.find((a) => a.id === id)?.status !== 'active') throw unavailable('arrowSet', id);
      }
    },
  };
}

export type CheckComponents = ReturnType<typeof createCheckComponents>;
