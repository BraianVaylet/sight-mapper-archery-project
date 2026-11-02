import type { BowPage, BowQuery, BowRepositories } from '../domain/bow.js';

export type ListBowsDeps = { readonly bows: BowRepositories };

/** The archer's bows, newest edit first, `active` unless they ask for the archived ones. */
export function createListBows(deps: ListBowsDeps) {
  return function listBows(userId: string, query: BowQuery): Promise<BowPage> {
    return deps.bows.forUser(userId).list(query);
  };
}
