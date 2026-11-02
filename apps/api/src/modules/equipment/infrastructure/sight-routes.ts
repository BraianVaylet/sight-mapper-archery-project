import { createRoute, z } from '@hono/zod-openapi';
import {
  sight as sightSchema,
  sightDetail,
  createSight,
  listQuery,
  page,
  updateSight,
  uuidv7,
} from '@sight-mapper/schemas';
import type { Context } from 'hono';
import { expectedVersion, setEtag } from '../../../core/concurrency/concurrency.js';
import type { AppBindings } from '../../../core/http/context.js';
import { AppError } from '../../../core/http/errors.js';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { Sight } from '../domain/sight.js';
import type { createChangeSightStatus } from '../application/change-sight-status.js';
import type { createCreateSight } from '../application/create-sight.js';
import type { createDeleteSight } from '../application/delete-sight.js';
import type { createGetSight } from '../application/get-sight.js';
import type { createListSights } from '../application/list-sights.js';
import type { createUpdateSight } from '../application/update-sight.js';

export type SightRoutesDeps = {
  readonly listSights: ReturnType<typeof createListSights>;
  readonly getSight: ReturnType<typeof createGetSight>;
  readonly createSight: ReturnType<typeof createCreateSight>;
  readonly updateSight: ReturnType<typeof createUpdateSight>;
  readonly changeSightStatus: ReturnType<typeof createChangeSightStatus>;
  readonly deleteSight: ReturnType<typeof createDeleteSight>;
};

const json = <S extends z.ZodType>(schema: S) => ({ 'application/json': { schema } });
const idParam = z.object({ id: uuidv7 });

/** Who is calling comes from the session, never from the body, the query or the path. */
function owner(c: Context<AppBindings>): string {
  const userId = c.get('userId');
  if (userId === undefined) throw new AppError('SM-CORE-401-001');
  return userId;
}

/** A sight as it goes on the wire: ISO instants, no user id (ADR-000). */
export function sightToWire(sight: Sight) {
  const { createdAt, updatedAt, deletedAt, ...rest } = sight;
  return {
    ...rest,
    // Left out of the JSON: the owner is the session's, and the client never needs it.
    userId: undefined,
    createdAt: createdAt.toString(),
    updatedAt: updatedAt.toString(),
    deletedAt: deletedAt === null ? null : deletedAt.toString(),
  };
}

export function registerSightRoutes(registry: RouteRegistry, deps: SightRoutesDeps): void {
  const tags = ['equipment'];

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/sights',
      tags,
      summary: 'List sights (active unless asked otherwise), newest edit first',
      request: { query: listQuery },
      responses: { 200: { description: 'A page of sights', content: json(page(sightSchema)) } },
    }),
    async (c) => {
      const result = await deps.listSights(owner(c), c.req.valid('query'));
      return c.json({ items: result.items.map(sightToWire), nextCursor: result.nextCursor }, 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/sights',
      tags,
      summary: 'Add a sight (the id is made by the client)',
      request: { body: { required: true, content: json(createSight) } },
      responses: { 201: { description: 'The sight', content: json(sightSchema) } },
    }),
    async (c) => {
      const created = await deps.createSight(owner(c), c.req.valid('json'));
      setEtag(c, created);
      return c.json(sightToWire(created), 201);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/sights/{id}',
      tags,
      summary: 'A sight and how many setups and marks use it',
      request: { params: idParam },
      responses: { 200: { description: 'The sight', content: json(sightDetail) } },
    }),
    async (c) => {
      const { sight, usage } = await deps.getSight(owner(c), c.req.valid('param').id);
      setEtag(c, sight);
      return c.json({ ...sightToWire(sight), usage }, 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'patch',
      path: '/api/v1/sights/{id}',
      tags,
      summary: 'Edit some fields of a sight (null clears one)',
      request: { params: idParam, body: { required: true, content: json(updateSight) } },
      responses: { 200: { description: 'The sight, updated', content: json(sightSchema) } },
    }),
    async (c) => {
      const updated = await deps.updateSight(
        owner(c),
        c.req.valid('param').id,
        c.req.valid('json'),
        expectedVersion(c),
      );
      setEtag(c, updated);
      return c.json(sightToWire(updated), 200);
    },
    { auth: 'session' },
  );

  for (const [action, status] of [
    ['archive', 'archived'],
    ['unarchive', 'active'],
  ] as const) {
    registry.register(
      createRoute({
        method: 'post',
        path: `/api/v1/sights/{id}/${action}`,
        tags,
        summary: action === 'archive' ? 'Archive a sight' : 'Bring an archived sight back',
        request: { params: idParam },
        responses: { 200: { description: 'The sight', content: json(sightSchema) } },
      }),
      async (c) => {
        const changed = await deps.changeSightStatus(owner(c), c.req.valid('param').id, status);
        setEtag(c, changed);
        return c.json(sightToWire(changed), 200);
      },
      { auth: 'session' },
    );
  }

  registry.register(
    createRoute({
      method: 'delete',
      path: '/api/v1/sights/{id}',
      tags,
      summary: 'Delete a sight that no setup uses (soft delete)',
      request: { params: idParam },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      await deps.deleteSight(owner(c), c.req.valid('param').id, expectedVersion(c));
      return c.body(null, 204);
    },
    { auth: 'session' },
  );
}
