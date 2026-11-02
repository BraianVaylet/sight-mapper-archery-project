import type { SightPage, SightQuery, SightRepositories } from '../domain/sight.js';

export type ListSightsDeps = { readonly sights: SightRepositories };

/** The archer's sights, newest edit first, `active` unless they ask for the archived ones. */
export function createListSights(deps: ListSightsDeps) {
  return function listSights(userId: string, query: SightQuery): Promise<SightPage> {
    return deps.sights.forUser(userId).list(query);
  };
}
