import { Temporal } from '@js-temporal/polyfill';
import type { CreateMark } from '@sight-mapper/schemas';
import type { Transact } from '../../../core/db/transaction.js';
import type { Mark, MarkRepositories } from '../domain/mark.js';
import type { Clock } from '../domain/setup.js';
import { duplicateDistance, type MarkChecks } from './mark-checks.js';

export type CreateMarkDeps = {
  readonly marks: MarkRepositories;
  readonly checks: MarkChecks;
  readonly clock: Clock;
  readonly transact: Transact;
};

export type CreatedMark = { readonly mark: Mark; readonly replaced: boolean };

/**
 * HU-MRK-01 and HU-MRK-02. The mark must live in a setup of the archer (404), with one of its arrow
 * sets (`SM-MARK-422-002`), on the scale of its sight (`SM-MARK-422-001`). A second mark at the same
 * distance is `SM-MARK-409-001` with the first one's id; with `replace: true` that first mark takes
 * the new reading instead, so exactly one stays.
 */
export function createCreateMark(deps: CreateMarkDeps) {
  return async function createMark(userId: string, input: CreateMark): Promise<CreatedMark> {
    const setup = await deps.checks.setupOf(userId, input.setupId);
    deps.checks.arrowSetBelongs(setup, input.arrowSetId);
    await deps.checks.onScale(userId, setup, input.scaleValueMm);
    const measuredAt = deps.checks.measuredAt(
      input.measuredAt === undefined ? undefined : Temporal.Instant.from(input.measuredAt),
    );

    const repository = deps.marks.forUser(userId);
    return deps.transact(async () => {
      const existing = await repository.findAtDistance(
        input.setupId,
        input.arrowSetId,
        input.distanceM,
      );
      const now = deps.clock.now();

      if (existing !== null) {
        if (!input.replace) throw duplicateDistance(existing);
        const mark = await repository.update(
          existing.id,
          {
            scaleValueMm: input.scaleValueMm,
            measuredAt,
            note: input.note ?? null,
          },
          existing.version,
          now,
        );
        return { mark, replaced: true };
      }

      const mark: Mark = {
        id: input.id,
        userId,
        setupId: input.setupId,
        arrowSetId: input.arrowSetId,
        distanceM: input.distanceM,
        scaleValueMm: input.scaleValueMm,
        origin: 'measured',
        ...(input.note == null ? {} : { note: input.note }),
        measuredAt,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await repository.insert(mark);
      return { mark, replaced: false };
    });
  };
}
