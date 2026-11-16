import type { SetupRepositories } from '../domain/setup.js';

/**
 * What the account module may ask of the calculator (it never imports it): the arrow sets of one
 * live setup of this archer, or `null` when there is no such setup. A setup in the trash is not live.
 */
export function createSetupLookup(deps: { readonly setups: SetupRepositories }) {
  return {
    async arrowSetIdsOf(userId: string, setupId: string): Promise<readonly string[] | null> {
      const setup = await deps.setups.forUser(userId).find(setupId);
      return setup === null ? null : setup.arrowSetIds;
    },
  };
}
