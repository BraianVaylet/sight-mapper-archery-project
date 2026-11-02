import type { Temporal } from '@js-temporal/polyfill';
import type { ComponentUsage } from '@sight-mapper/schemas';
import type { ComponentStatus } from '@sight-mapper/types';

/** What every piece of equipment carries besides what the archer describes (DICCIONARIO §3). */
export type ComponentMeta = {
  readonly id: string;
  readonly userId: string;
  readonly status: ComponentStatus;
  readonly version: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly deletedAt: Temporal.Instant | null;
};

export type ComponentQuery = {
  readonly status: ComponentStatus;
  readonly cursor?: string | undefined;
  readonly limit: number;
};

export type ComponentPage<E> = { readonly items: readonly E[]; readonly nextCursor: string | null };

/** One archer's components of one kind: the user id is fixed when the repository is made (ADR-000). */
export type ComponentRepository<E extends ComponentMeta, Patch extends object> = {
  list(query: ComponentQuery): Promise<ComponentPage<E>>;
  find(id: string): Promise<E | null>;
  /** A repeated `id` is `SM-CORE-409-002`. */
  insert(entity: E): Promise<void>;
  /** `null` clears a field, absent leaves it. Stale `expectedVersion` is `SM-CORE-412-001`. */
  update(id: string, patch: Patch, expectedVersion: number, now: Temporal.Instant): Promise<E>;
  /** A transition (`archive`, `unarchive`): never a free-form edit of `status` (ADR-008). */
  setStatus(id: string, status: ComponentStatus, now: Temporal.Instant): Promise<E>;
  /** Soft delete. Stale `expectedVersion` is `SM-CORE-412-001`. */
  softDelete(id: string, expectedVersion: number, now: Temporal.Instant): Promise<void>;
};

export type ComponentRepositories<E extends ComponentMeta, Patch extends object> = {
  forUser(userId: string): ComponentRepository<E, Patch>;
};

/** How many setups and marks lean on a component (declared here, answered by the calculator). */
export type UsageOf = (userId: string, id: string) => Promise<ComponentUsage>;

export type Clock = { now(): Temporal.Instant };
