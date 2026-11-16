import { createSight, sight as sightSchema, sightDetail, updateSight } from '@sight-mapper/schemas';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { ComponentUseCases } from '../application/component-use-cases.js';
import type { createCreateSight } from '../application/create-sight.js';
import type { createUpdateSight } from '../application/update-sight.js';
import type { Sight, SightPatch } from '../domain/sight.js';
import { registerComponentRoutes } from './component-routes.js';

export type SightRoutesDeps = {
  readonly shared: ComponentUseCases<Sight, SightPatch>;
  readonly create: ReturnType<typeof createCreateSight>;
  readonly update: ReturnType<typeof createUpdateSight>;
};

/** `/api/v1/sights`: the seven routes every kind of equipment has (TECNICO §5.3). */
export function registerSightRoutes(registry: RouteRegistry, deps: SightRoutesDeps): void {
  registerComponentRoutes(registry, {
    path: '/api/v1/sights',
    noun: 'sight',
    item: sightSchema,
    detail: sightDetail,
    create: createSight,
    update: updateSight,
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
