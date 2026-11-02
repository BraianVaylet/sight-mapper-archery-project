import type { Attack } from '../helpers/isolation.js';
import { accountAttacks } from './account.js';
import { bowAttacks } from './bows.js';

/**
 * Every attack of every module: the real container registers all their routes, and the suite
 * fails a session route that has none. A module adds its attacks here, in the same change.
 */
export const productionAttacks: Attack[] = [...accountAttacks, ...bowAttacks];
