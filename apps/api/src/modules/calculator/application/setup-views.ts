import type { SetupView } from '@sight-mapper/schemas';
import type { EquipmentReadPort, Setup, SetupMarksPort } from '../domain/setup.js';

export type SetupViewsDeps = {
  readonly equipment: EquipmentReadPort;
  readonly marks: SetupMarksPort;
};

/**
 * Setups as the app reads them: each one with its bow, sight (and scale) and arrow sets, and how
 * many marks it holds. Equipment is read through the port, one call per kind for the whole page.
 */
export function createSetupViews(deps: SetupViewsDeps) {
  return async function toViews(userId: string, setups: readonly Setup[]): Promise<SetupView[]> {
    if (setups.length === 0) return [];
    const unique = (ids: readonly string[]) => [...new Set(ids)];
    const [bows, sights, arrowSets, counts] = await Promise.all([
      deps.equipment.bows(userId, unique(setups.map((s) => s.bowId))),
      deps.equipment.sights(userId, unique(setups.map((s) => s.sightId))),
      deps.equipment.arrowSets(userId, unique(setups.flatMap((s) => s.arrowSetIds))),
      deps.marks.countBySetup(
        userId,
        setups.map((s) => s.id),
      ),
    ]);
    const bowById = new Map(bows.map((b) => [b.id, b]));
    const sightById = new Map(sights.map((s) => [s.id, s]));
    const setById = new Map(arrowSets.map((a) => [a.id, a]));

    return setups.flatMap((setup): SetupView[] => {
      const bow = bowById.get(setup.bowId);
      const sight = sightById.get(setup.sightId);
      // A component cannot disappear under a setup (the delete is protected); if the data says
      // otherwise the setup is left out rather than shown half-drawn.
      if (bow === undefined || sight === undefined) return [];
      return [
        {
          id: setup.id,
          version: setup.version,
          createdAt: setup.createdAt.toString(),
          updatedAt: setup.updatedAt.toString(),
          deletedAt: setup.deletedAt === null ? null : setup.deletedAt.toString(),
          ...(setup.name == null ? {} : { name: setup.name }),
          bowId: setup.bowId,
          sightId: setup.sightId,
          arrowSetIds: [...setup.arrowSetIds],
          isFavorite: setup.isFavorite,
          status: setup.status,
          bow,
          sight,
          arrowSets: setup.arrowSetIds.flatMap((id) => {
            const found = setById.get(id);
            return found === undefined ? [] : [found];
          }),
          marksCount: counts.get(setup.id) ?? 0,
        },
      ];
    });
  };
}

export type SetupViews = ReturnType<typeof createSetupViews>;
