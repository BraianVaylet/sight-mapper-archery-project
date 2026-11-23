import type { Temporal } from '@js-temporal/polyfill';
import type { MarkOrigin } from '@sight-mapper/types';

/** A measured point of a sight: at `distanceM` the archer set the scale to `scaleValueMm`. */
export type Mark = {
  readonly id: string;
  readonly userId: string;
  readonly setupId: string;
  readonly arrowSetId: string;
  /** Metres, to 1 mm (ADR-005). */
  readonly distanceM: number;
  /** Position on the scale in mm (ADR-005): the reading times the size of one unit. */
  readonly scaleValueMm: number;
  /** Windage in mm on the horizontal scale (F1-42). `null`: not written down. Never estimated. */
  readonly windageMm: number | null;
  readonly origin: MarkOrigin;
  readonly note?: string | null | undefined;
  readonly measuredAt: Temporal.Instant;
  readonly version: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly deletedAt: Temporal.Instant | null;
};

/** Which scale of the sight a position is on: the height (`scaleValueMm`) or the windage. */
export type MarkAxis = 'vertical' | 'windage';

/** What a PATCH writes. `null` clears the note or the windage. */
export type MarkPatch = {
  readonly distanceM?: number | undefined;
  readonly scaleValueMm?: number | undefined;
  readonly windageMm?: number | null | undefined;
  readonly note?: string | null | undefined;
  readonly measuredAt?: Temporal.Instant | undefined;
};

/** One archer's marks: the user id is fixed when the repository is made (ADR-000). */
export type MarkRepository = {
  /** The live marks of one (setup, arrow set) pair, nearest first. At most `limit`. */
  listByPair(setupId: string, arrowSetId: string, limit: number): Promise<readonly Mark[]>;
  find(id: string): Promise<Mark | null>;
  findInTrash(id: string): Promise<Mark | null>;
  /** The live mark at this distance for the pair, if any (RN-MRK-04). */
  findAtDistance(setupId: string, arrowSetId: string, distanceM: number): Promise<Mark | null>;
  /** A repeated `id` is `SM-CORE-409-002`. */
  insert(mark: Mark): Promise<void>;
  /** Stale `expectedVersion` is `SM-CORE-412-001`. */
  update(
    id: string,
    patch: MarkPatch,
    expectedVersion: number,
    now: Temporal.Instant,
  ): Promise<Mark>;
  /** Soft delete. Stale `expectedVersion` is `SM-CORE-412-001`. */
  softDelete(id: string, expectedVersion: number, now: Temporal.Instant): Promise<void>;
  restore(id: string, now: Temporal.Instant): Promise<Mark>;

  /** Live marks per setup, for the Home. A setup with none is absent. */
  countBySetup(setupIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  countForArrowSet(setupId: string, arrowSetId: string): Promise<number>;

  /** RN-STP-06: the marks follow their setup into the trash, and back out of it. */
  trashBySetup(setupId: string, now: Temporal.Instant): Promise<void>;
  restoreBySetup(setupId: string, now: Temporal.Instant): Promise<void>;

  /**
   * Positions on one axis of every live mark of these setups, for a scale change on their sight.
   * Marks with no windage have no position on that axis.
   */
  positionsOf(setupIds: readonly string[], axis: MarkAxis): Promise<readonly number[]>;
  /** Rewrites those positions: each becomes `position * factor` (keeping readings). */
  scalePositions(
    setupIds: readonly string[],
    factor: number,
    now: Temporal.Instant,
    axis: MarkAxis,
  ): Promise<void>;
};

export type MarkRepositories = { forUser(userId: string): MarkRepository };
