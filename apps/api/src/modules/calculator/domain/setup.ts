import type { Temporal } from '@js-temporal/polyfill';
import type { ArrowSetRef, BowRef, ComponentUsage, SightRef } from '@sight-mapper/schemas';
import type { ComponentStatus } from '@sight-mapper/types';

/** What defines a setup: one bow, one sight, one or more arrow sets (RN-STP-01). */
export type Setup = {
  readonly id: string;
  readonly userId: string;
  readonly name?: string | null | undefined;
  readonly bowId: string;
  readonly sightId: string;
  readonly arrowSetIds: readonly string[];
  readonly isFavorite: boolean;
  readonly status: ComponentStatus;
  readonly version: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  /** Set while the setup is in the trash (RN-STP-06). */
  readonly deletedAt: Temporal.Instant | null;
};

export type SetupPage = { readonly items: readonly Setup[]; readonly nextCursor: string | null };

export type SetupQuery = {
  readonly status: ComponentStatus;
  readonly cursor?: string | undefined;
  readonly limit: number;
};

/** What a PATCH may change. The bow and the sight never do: a different pair is another setup. */
export type SetupPatch = {
  readonly name?: string | null | undefined;
  readonly isFavorite?: boolean | undefined;
  readonly arrowSetIds?: readonly string[] | undefined;
};

export type ComponentKind = 'bow' | 'sight' | 'arrowSet';

/** One archer's setups: the user id is fixed when the repository is made (ADR-000). */
export type SetupRepository = {
  /** The Home: favourites first, then the latest edit. Setups in the trash are not here. */
  list(query: SetupQuery): Promise<SetupPage>;
  find(id: string): Promise<Setup | null>;
  /** The live setup that has this pair, if any (RN-STP-03). */
  findByPair(bowId: string, sightId: string): Promise<Setup | null>;
  /** A repeated `id` is `SM-CORE-409-002`; a live setup with the same pair is `SM-STP-409-001`. */
  insert(setup: Setup): Promise<void>;
  /** Stale `expectedVersion` is `SM-CORE-412-001`. */
  update(
    id: string,
    patch: SetupPatch,
    expectedVersion: number,
    now: Temporal.Instant,
  ): Promise<Setup>;
  /** `archive` / `unarchive`: never a free-form edit of `status`. */
  setStatus(id: string, status: ComponentStatus, now: Temporal.Instant): Promise<Setup>;
  /** Sends the setup to the trash. Stale `expectedVersion` is `SM-CORE-412-001`. */
  moveToTrash(id: string, expectedVersion: number, now: Temporal.Instant): Promise<void>;
  /** The trash, the latest deleted first. */
  listTrash(): Promise<readonly Setup[]>;
  findInTrash(id: string): Promise<Setup | null>;
  restore(id: string, now: Temporal.Instant): Promise<Setup>;
  /** Ids of the live setups (archived ones too) that use a component. */
  idsUsing(kind: ComponentKind, componentId: string): Promise<readonly string[]>;
};

export type SetupRepositories = { forUser(userId: string): SetupRepository };

/** A component as the calculator needs to see it: who it is, and whether it can still be chosen. */
export type ComponentRefs = {
  readonly bows: readonly BowRef[];
  readonly sights: readonly SightRef[];
  readonly arrowSets: readonly ArrowSetRef[];
};

/**
 * Declared here, implemented by the equipment module through the composition root
 * (ARQUITECTURA §4.2): what the calculator may know about equipment. Only components of this
 * archer come back; one that is not theirs, or not there, is simply missing.
 */
export type EquipmentReadPort = {
  bows(userId: string, ids: readonly string[]): Promise<readonly BowRef[]>;
  sights(userId: string, ids: readonly string[]): Promise<readonly SightRef[]>;
  arrowSets(userId: string, ids: readonly string[]): Promise<readonly ArrowSetRef[]>;
};

/**
 * The marks of a setup, as the setup rules need them: the count on the Home, RN-STP-05, and the
 * trash cascade (RN-STP-06). The mark module implements it.
 */
export type SetupMarksPort = {
  /** Live marks per setup, for the Home. A setup with none is absent or zero. */
  countBySetup(userId: string, setupIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  /** Live marks of one setup measured with one arrow set (RN-STP-05). */
  countForArrowSet(userId: string, setupId: string, arrowSetId: string): Promise<number>;
  /** RN-STP-06: the marks go to the trash with their setup, and come back with it. */
  trashBySetup(userId: string, setupId: string, now: Temporal.Instant): Promise<void>;
  restoreBySetup(userId: string, setupId: string, now: Temporal.Instant): Promise<void>;
};

export type Clock = { now(): Temporal.Instant };

export type { ComponentUsage };
