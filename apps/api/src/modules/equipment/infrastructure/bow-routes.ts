import { bow as bowSchema, bowDetail, createBow, updateBow } from '@sight-mapper/schemas';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { ComponentUseCases } from '../application/component-use-cases.js';
import type { createCreateBow } from '../application/create-bow.js';
import type { createUpdateBow } from '../application/update-bow.js';
import type { Bow } from '../domain/bow.js';
import { registerComponentRoutes } from './component-routes.js';

export type BowRoutesDeps = {
  readonly shared: ComponentUseCases<Bow, Parameters<ReturnType<typeof createUpdateBow>>[2]>;
  readonly create: ReturnType<typeof createCreateBow>;
  readonly update: ReturnType<typeof createUpdateBow>;
};

/** `/api/v1/bows`: the seven routes every kind of equipment has (TECNICO §5.3). */
export function registerBowRoutes(registry: RouteRegistry, deps: BowRoutesDeps): void {
  registerComponentRoutes(registry, {
    path: '/api/v1/bows',
    noun: 'bow',
    item: bowSchema,
    detail: bowDetail,
    create: createBow,
    update: updateBow,
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
