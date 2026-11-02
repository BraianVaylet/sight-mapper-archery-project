import {
  arrowSet as arrowSetSchema,
  arrowSetDetail,
  createArrowSet,
  updateArrowSet,
} from '@sight-mapper/schemas';
import type { ArrowSet } from '../domain/arrow-set.js';
import type { ComponentUseCases } from '../application/component-use-cases.js';
import type { createCreateArrowSet } from '../application/create-arrow-set.js';
import type { createUpdateArrowSet } from '../application/update-arrow-set.js';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import { registerComponentRoutes } from './component-routes.js';

export type ArrowSetRoutesDeps = {
  readonly shared: ComponentUseCases<
    ArrowSet,
    Parameters<ReturnType<typeof createUpdateArrowSet>>[2]
  >;
  readonly create: ReturnType<typeof createCreateArrowSet>;
  readonly update: ReturnType<typeof createUpdateArrowSet>;
};

/** `/api/v1/arrow-sets`: the seven routes every kind of equipment has (TECNICO §5.3). */
export function registerArrowSetRoutes(registry: RouteRegistry, deps: ArrowSetRoutesDeps): void {
  registerComponentRoutes(registry, {
    path: '/api/v1/arrow-sets',
    noun: 'arrow set',
    item: arrowSetSchema,
    detail: arrowSetDetail,
    create: createArrowSet,
    update: updateArrowSet,
    handlers: {
      list: deps.shared.list,
      get: deps.shared.get,
      create: deps.create,
      update: deps.update,
      changeStatus: deps.shared.changeStatus,
      remove: deps.shared.remove,
    },
  });
}
