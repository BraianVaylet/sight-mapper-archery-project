import type { ComponentUsage } from '@sight-mapper/schemas';
import type { ComponentKind, SetupMarksPort, SetupRepositories } from '../domain/setup.js';

export type ComponentUsageDeps = {
  readonly setups: SetupRepositories;
  readonly marks: SetupMarksPort;
};

/**
 * The real answer to equipment's "how much leans on this component?" (ADR-008): the live setups
 * that use it, archived ones included, and the marks that would be lost with it. This is what
 * makes the protected delete of a bow, sight or arrow set refuse to run.
 */
export function createComponentUsage(deps: ComponentUsageDeps) {
  const usageOf =
    (kind: ComponentKind) =>
    async (userId: string, componentId: string): Promise<ComponentUsage> => {
      const setupIds = await deps.setups.forUser(userId).idsUsing(kind, componentId);
      if (setupIds.length === 0) return { setups: 0, marks: 0 };

      let marks = 0;
      if (kind === 'arrowSet') {
        // Only the marks shot with this arrow set count, not every mark of its setups.
        for (const setupId of setupIds) {
          marks += await deps.marks.countForArrowSet(userId, setupId, componentId);
        }
      } else {
        const counts = await deps.marks.countBySetup(userId, setupIds);
        for (const setupId of setupIds) marks += counts.get(setupId) ?? 0;
      }
      return { setups: setupIds.length, marks };
    };

  return {
    bowUsage: usageOf('bow'),
    sightUsage: usageOf('sight'),
    arrowSetUsage: usageOf('arrowSet'),
  };
}
