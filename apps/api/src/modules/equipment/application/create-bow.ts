import type { CreateBow } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Bow, BowRepositories, Clock } from '../domain/bow.js';

export type CreateBowDeps = { readonly bows: BowRepositories; readonly clock: Clock };

/** Only compound bows for now (SM-BOW-422-001); the others are in the schema for later. */
export function createCreateBow(deps: CreateBowDeps) {
  return async function createBow(userId: string, input: CreateBow): Promise<Bow> {
    if (input.bowType !== 'compound') {
      throw new AppError('SM-BOW-422-001', { bowType: input.bowType });
    }
    const now = deps.clock.now();
    const { id, ...fields } = input;
    const bow: Bow = {
      ...fields,
      id,
      userId,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await deps.bows.forUser(userId).insert(bow);
    return bow;
  };
}
