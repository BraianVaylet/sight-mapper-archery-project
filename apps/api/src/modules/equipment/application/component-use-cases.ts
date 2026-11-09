import type { ComponentUsage } from '@sight-mapper/schemas';
import type { ComponentStatus, ErrorCode } from '@sight-mapper/types';
import { AppError } from '../../../core/http/errors.js';
import type {
  Clock,
  ComponentMeta,
  ComponentPage,
  ComponentQuery,
  ComponentRepositories,
  UsageOf,
} from '../domain/component.js';

export type ComponentUseCasesDeps<E extends ComponentMeta, Patch extends object> = {
  readonly repositories: ComponentRepositories<E, Patch>;
  readonly usage: UsageOf;
  readonly clock: Clock;
  /** For the 404: `'arrow set'`. */
  readonly resource: string;
  /** The "in use" error of this kind of equipment (`SM-ARW-409-001`). */
  readonly inUseCode: ErrorCode;
};

/**
 * The use cases every kind of equipment shares: read, list, archive and the protected delete.
 * What differs (the rules of creating or editing) stays with each kind.
 */
export function createComponentUseCases<E extends ComponentMeta, Patch extends object>(
  deps: ComponentUseCasesDeps<E, Patch>,
) {
  const { repositories, usage, clock, resource, inUseCode } = deps;
  const notFound = () => new AppError('SM-CORE-404-002', { resource });

  return {
    /** Newest edit first, `active` unless the archer asks for the archived ones. */
    list: (userId: string, query: ComponentQuery): Promise<ComponentPage<E>> =>
      repositories.forUser(userId).list(query),

    /** The component and how much of the account leans on it. Not yours or not there: 404. */
    async get(userId: string, id: string): Promise<{ entity: E; usage: ComponentUsage }> {
      const entity = await repositories.forUser(userId).find(id);
      if (entity === null) throw notFound();
      return { entity, usage: await usage(userId, id) };
    },

    /** `archive` / `unarchive` (ADR-008): idempotent, so it needs no `If-Match`. */
    changeStatus: (userId: string, id: string, status: ComponentStatus): Promise<E> =>
      repositories.forUser(userId).setStatus(id, status, clock.now()),

    /** A component a setup uses is archived, not deleted; the error says how many setups and marks. */
    async remove(userId: string, id: string, expectedVersion: number): Promise<void> {
      const repository = repositories.forUser(userId);
      if ((await repository.find(id)) === null) throw notFound();
      const used = await usage(userId, id);
      if (used.setups > 0) throw new AppError(inUseCode, used);
      await repository.softDelete(id, expectedVersion, clock.now());
    },
  };
}

export type ComponentUseCases<E extends ComponentMeta, Patch extends object> = ReturnType<
  typeof createComponentUseCases<E, Patch>
>;
