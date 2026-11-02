import { Temporal } from '@js-temporal/polyfill';
import { TRASH_DAYS } from '@sight-mapper/schemas';
import type { ComponentStatus } from '@sight-mapper/types';
import { AppError } from '../../../core/http/errors.js';
import type { Clock, SetupPage, SetupQuery, SetupRepositories } from '../domain/setup.js';

export type SetupUseCasesDeps = { readonly setups: SetupRepositories; readonly clock: Clock };

/** When a setup deleted at `deletedAt` is purged for good. */
export const purgeAt = (deletedAt: Temporal.Instant): Temporal.Instant =>
  deletedAt.add({ hours: TRASH_DAYS * 24 });

/** Reading, archiving, the trash and the restore: the setup rules that need no component. */
export function createSetupUseCases(deps: SetupUseCasesDeps) {
  const { setups, clock } = deps;
  const notFound = () => new AppError('SM-CORE-404-002', { resource: 'setup' });

  return {
    list: (userId: string, query: SetupQuery): Promise<SetupPage> =>
      setups.forUser(userId).list(query),

    async get(userId: string, id: string) {
      const setup = await setups.forUser(userId).find(id);
      if (setup === null) throw notFound();
      return setup;
    },

    /** `archive` / `unarchive`: idempotent, so no `If-Match`. */
    changeStatus: (userId: string, id: string, status: ComponentStatus) =>
      setups.forUser(userId).setStatus(id, status, clock.now()),

    /** RF-STP-06: the setup goes to the trash; its marks follow when they exist (F1-07). */
    async moveToTrash(userId: string, id: string, expectedVersion: number): Promise<void> {
      const repository = setups.forUser(userId);
      if ((await repository.find(id)) === null) throw notFound();
      await repository.moveToTrash(id, expectedVersion, clock.now());
    },

    listTrash: (userId: string) => setups.forUser(userId).listTrash(),

    /** HU-STP-04: restorable for 30 days, then `SM-STP-410-001`. */
    async restore(userId: string, id: string) {
      const repository = setups.forUser(userId);
      const trashed = await repository.findInTrash(id);
      if (trashed === null || trashed.deletedAt === null) throw notFound();
      const now = clock.now();
      if (Temporal.Instant.compare(now, purgeAt(trashed.deletedAt)) > 0) {
        throw new AppError('SM-STP-410-001', { deletedAt: trashed.deletedAt.toString() });
      }
      // Another setup may have taken the pair while this one was in the trash (RN-STP-03). The
      // unique index settles a race; this answers the common case with the setup that has it.
      const taken = await repository.findByPair(trashed.bowId, trashed.sightId);
      if (taken !== null) throw new AppError('SM-STP-409-001', { existingSetupId: taken.id });
      return repository.restore(id, now);
    },
  };
}

export type SetupUseCases = ReturnType<typeof createSetupUseCases>;
