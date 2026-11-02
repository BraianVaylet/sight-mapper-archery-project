import type { Temporal } from '@js-temporal/polyfill';
import type { ComponentUsage, CreateBow, UpdateBow } from '@sight-mapper/schemas';
import type { ComponentStatus } from '@sight-mapper/types';

/** What the archer describes about a bow: the same shape the API accepts, minus the id. */
export type BowFields = Omit<CreateBow, 'id'>;

export type Bow = BowFields & {
  readonly id: string;
  readonly userId: string;
  readonly status: ComponentStatus;
  readonly version: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly deletedAt: Temporal.Instant | null;
};

export type BowPage = { readonly items: readonly Bow[]; readonly nextCursor: string | null };

export type BowQuery = {
  readonly status: ComponentStatus;
  readonly cursor?: string | undefined;
  readonly limit: number;
};

/** One archer's bows: the user id is fixed when the repository is made (ADR-000). */
export type BowRepository = {
  list(query: BowQuery): Promise<BowPage>;
  find(id: string): Promise<Bow | null>;
  /** A repeated `id` is `SM-CORE-409-002`. */
  insert(bow: Bow): Promise<void>;
  /** `null` clears a field, absent leaves it. Stale `expectedVersion` is `SM-CORE-412-001`. */
  update(
    id: string,
    patch: UpdateBow,
    expectedVersion: number,
    now: Temporal.Instant,
  ): Promise<Bow>;
  /** A transition (`archive`, `unarchive`): never a free-form edit of `status` (ADR-008). */
  setStatus(id: string, status: ComponentStatus, now: Temporal.Instant): Promise<Bow>;
  /** Soft delete. Stale `expectedVersion` is `SM-CORE-412-001`. */
  softDelete(id: string, expectedVersion: number, now: Temporal.Instant): Promise<void>;
};

export type BowRepositories = { forUser(userId: string): BowRepository };

/**
 * Declared here, implemented by the calculator module (ARQUITECTURA §4.2): how many setups and
 * marks lean on a bow. Equipment never imports calculator.
 */
export type ComponentUsagePort = {
  bowUsage(userId: string, bowId: string): Promise<ComponentUsage>;
};

export type Clock = { now(): Temporal.Instant };
