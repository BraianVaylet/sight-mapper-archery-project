import { Temporal } from '@js-temporal/polyfill';
import { MAX_MARKS_PER_PAIR, TRASH_DAYS } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Mark, MarkRepositories } from '../domain/mark.js';
import type { Clock } from '../domain/setup.js';
import { duplicateDistance, type MarkChecks } from './mark-checks.js';

export type MarkUseCasesDeps = {
  readonly marks: MarkRepositories;
  readonly checks: MarkChecks;
  readonly clock: Clock;
};

/** Listing, deleting and undoing: the mark rules that need no new reading. */
export function createMarkUseCases(deps: MarkUseCasesDeps) {
  const { marks, checks, clock } = deps;
  const notFound = () => new AppError('SM-CORE-404-002', { resource: 'mark' });

  return {
    /** HU-MRK-04: every live mark of the pair, nearest first, at most 500 and never paged. */
    async listByPair(
      userId: string,
      setupId: string,
      arrowSetId: string,
    ): Promise<readonly Mark[]> {
      const setup = await checks.setupOf(userId, setupId);
      checks.arrowSetBelongs(setup, arrowSetId);
      return marks.forUser(userId).listByPair(setupId, arrowSetId, MAX_MARKS_PER_PAIR);
    },

    /** Soft delete: it can be undone for 30 days (`restore`). */
    async remove(userId: string, id: string, expectedVersion: number): Promise<void> {
      const repository = marks.forUser(userId);
      if ((await repository.find(id)) === null) throw notFound();
      await repository.softDelete(id, expectedVersion, clock.now());
    },

    /** "Deshacer": within 30 days, and only if the distance has not been taken again. */
    async restore(userId: string, id: string): Promise<Mark> {
      const repository = marks.forUser(userId);
      const trashed = await repository.findInTrash(id);
      if (trashed === null || trashed.deletedAt === null) throw notFound();
      const now = clock.now();
      if (Temporal.Instant.compare(now, trashed.deletedAt.add({ hours: TRASH_DAYS * 24 })) > 0) {
        throw new AppError('SM-MARK-410-001', { deletedAt: trashed.deletedAt.toString() });
      }
      const taken = await repository.findAtDistance(
        trashed.setupId,
        trashed.arrowSetId,
        trashed.distanceM,
      );
      if (taken !== null) throw duplicateDistance(taken);
      return repository.restore(id, now);
    },
  };
}

export type MarkUseCases = ReturnType<typeof createMarkUseCases>;
