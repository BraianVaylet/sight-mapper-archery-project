import type { Temporal } from '@js-temporal/polyfill';
import type {
  ComponentUsage,
  CreateSight,
  SightScaleInput,
  UpdateSight,
} from '@sight-mapper/schemas';
import type { ComponentStatus, ScaleChangeStrategy } from '@sight-mapper/types';

/** What the archer describes about a sight: the shape the API accepts, minus the id. */
export type SightFields = Omit<CreateSight, 'id'>;

export type Sight = SightFields & {
  readonly id: string;
  readonly userId: string;
  readonly status: ComponentStatus;
  readonly version: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly deletedAt: Temporal.Instant | null;
};

export type SightPage = { readonly items: readonly Sight[]; readonly nextCursor: string | null };

export type SightQuery = {
  readonly status: ComponentStatus;
  readonly cursor?: string | undefined;
  readonly limit: number;
};

/** What a PATCH writes: the sight's own fields, without the instruction about its marks. */
export type SightPatch = Omit<UpdateSight, 'scaleChangeStrategy'>;

/** One archer's sights: the user id is fixed when the repository is made (ADR-000). */
export type SightRepository = {
  list(query: SightQuery): Promise<SightPage>;
  find(id: string): Promise<Sight | null>;
  /** A repeated `id` is `SM-CORE-409-002`. */
  insert(sight: Sight): Promise<void>;
  /** `null` clears a field, absent leaves it. Stale `expectedVersion` is `SM-CORE-412-001`. */
  update(
    id: string,
    patch: SightPatch,
    expectedVersion: number,
    now: Temporal.Instant,
  ): Promise<Sight>;
  setStatus(id: string, status: ComponentStatus, now: Temporal.Instant): Promise<Sight>;
  softDelete(id: string, expectedVersion: number, now: Temporal.Instant): Promise<void>;
};

export type SightRepositories = { forUser(userId: string): SightRepository };

/** How the marks of a sight must be treated when its scale changes (HU-SGT-02). */
export type ScaleChange = {
  readonly from: SightScaleInput;
  readonly to: SightScaleInput;
  readonly strategy: ScaleChangeStrategy | undefined;
};

/**
 * Declared here, implemented by the calculator module (ARQUITECTURA §4.2): the marks that live on
 * a sight. Equipment never imports calculator. Until that module exists the answer is "none".
 */
export type SightMarksPort = {
  /** Live marks measured on this sight, whatever the setup or arrow set. */
  count(userId: string, sightId: string): Promise<number>;
  /** How many marks would fall off the scale once `change` is applied. */
  countOutside(userId: string, sightId: string, change: ScaleChange): Promise<number>;
  /** Rewrites the marks for the new scale, keeping readings or positions. */
  rescale(userId: string, sightId: string, change: ScaleChange): Promise<void>;
};

export type SightUsagePort = {
  sightUsage(userId: string, sightId: string): Promise<ComponentUsage>;
};

export type Clock = { now(): Temporal.Instant };
