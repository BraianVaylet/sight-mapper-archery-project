import { Temporal } from '@js-temporal/polyfill';
import type { UpdateMark } from '@sight-mapper/schemas';
import { AppError } from '../../../core/http/errors.js';
import type { Transact } from '../../../core/db/transaction.js';
import type { Mark, MarkRepositories } from '../domain/mark.js';
import type { Clock } from '../domain/setup.js';
import { duplicateDistance, type MarkChecks } from './mark-checks.js';

export type UpdateMarkDeps = {
  readonly marks: MarkRepositories;
  readonly checks: MarkChecks;
  readonly clock: Clock;
  readonly transact: Transact;
};

/**
 * HU-MRK-03. Distance, reading, note and date can change; the setup and the arrow set cannot (a
 * different pair is another mark). A new reading must be on the scale (`SM-MARK-422-001`). Moving
 * to a distance that already has a mark is `SM-MARK-409-001`, unless `replace: true`, which sends
 * that other mark to the trash. A stale `If-Match` is `SM-CORE-412-001`.
 */
export function createUpdateMark(deps: UpdateMarkDeps) {
  return async function updateMark(
    userId: string,
    id: string,
    patch: UpdateMark,
    expectedVersion: number,
  ): Promise<Mark> {
    const repository = deps.marks.forUser(userId);
    const current = await repository.find(id);
    if (current === null) throw new AppError('SM-CORE-404-002', { resource: 'mark' });

    if (patch.scaleValueMm !== undefined) {
      const setup = await deps.checks.setupOf(userId, current.setupId);
      await deps.checks.onScale(userId, setup, patch.scaleValueMm);
    }
    const measuredAt =
      patch.measuredAt === undefined
        ? undefined
        : deps.checks.measuredAt(Temporal.Instant.from(patch.measuredAt));

    return deps.transact(async () => {
      const now = deps.clock.now();
      if (patch.distanceM !== undefined && patch.distanceM !== current.distanceM) {
        const taken = await repository.findAtDistance(
          current.setupId,
          current.arrowSetId,
          patch.distanceM,
        );
        if (taken !== null) {
          if (patch.replace !== true) throw duplicateDistance(taken);
          await repository.softDelete(taken.id, taken.version, now);
        }
      }
      return repository.update(
        id,
        {
          distanceM: patch.distanceM,
          scaleValueMm: patch.scaleValueMm,
          note: patch.note,
          measuredAt,
        },
        expectedVersion,
        now,
      );
    });
  };
}
