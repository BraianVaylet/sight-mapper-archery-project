import { createRoute, z } from '@hono/zod-openapi';
import {
  bow as bowSchema,
  bowDetail,
  createBow,
  listQuery,
  page,
  updateBow,
  uuidv7,
} from '@sight-mapper/schemas';
import type { Context } from 'hono';
import { expectedVersion, setEtag } from '../../../core/concurrency/concurrency.js';
import type { AppBindings } from '../../../core/http/context.js';
import { AppError } from '../../../core/http/errors.js';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { Bow } from '../domain/bow.js';
import type { createChangeBowStatus } from '../application/change-bow-status.js';
import type { createCreateBow } from '../application/create-bow.js';
import type { createDeleteBow } from '../application/delete-bow.js';
import type { createGetBow } from '../application/get-bow.js';
import type { createListBows } from '../application/list-bows.js';
import type { createUpdateBow } from '../application/update-bow.js';

export type BowRoutesDeps = {
  readonly listBows: ReturnType<typeof createListBows>;
  readonly getBow: ReturnType<typeof createGetBow>;
  readonly createBow: ReturnType<typeof createCreateBow>;
  readonly updateBow: ReturnType<typeof createUpdateBow>;
  readonly changeBowStatus: ReturnType<typeof createChangeBowStatus>;
  readonly deleteBow: ReturnType<typeof createDeleteBow>;
};

const json = <S extends z.ZodType>(schema: S) => ({ 'application/json': { schema } });
const idParam = z.object({ id: uuidv7 });

/** Who is calling comes from the session, never from the body, the query or the path. */
function owner(c: Context<AppBindings>): string {
  const userId = c.get('userId');
  if (userId === undefined) throw new AppError('SM-CORE-401-001');
  return userId;
}

/** A bow as it goes on the wire: ISO instants, no user id (ADR-000). */
export function bowToWire(bow: Bow) {
  const { createdAt, updatedAt, deletedAt, ...rest } = bow;
  return {
    ...rest,
    // Left out of the JSON: the owner is the session's, and the client never needs it.
    userId: undefined,
    createdAt: createdAt.toString(),
    updatedAt: updatedAt.toString(),
    deletedAt: deletedAt === null ? null : deletedAt.toString(),
  };
}

export function registerBowRoutes(registry: RouteRegistry, deps: BowRoutesDeps): void {
  const tags = ['equipment'];

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/bows',
      tags,
      summary: 'List bows (active unless asked otherwise), newest edit first',
      request: { query: listQuery },
      responses: { 200: { description: 'A page of bows', content: json(page(bowSchema)) } },
    }),
    async (c) => {
      const result = await deps.listBows(owner(c), c.req.valid('query'));
      return c.json({ items: result.items.map(bowToWire), nextCursor: result.nextCursor }, 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/bows',
      tags,
      summary: 'Add a bow (the id is made by the client)',
      request: { body: { required: true, content: json(createBow) } },
      responses: { 201: { description: 'The bow', content: json(bowSchema) } },
    }),
    async (c) => {
      const created = await deps.createBow(owner(c), c.req.valid('json'));
      setEtag(c, created);
      return c.json(bowToWire(created), 201);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/bows/{id}',
      tags,
      summary: 'A bow and how many setups and marks use it',
      request: { params: idParam },
      responses: { 200: { description: 'The bow', content: json(bowDetail) } },
    }),
    async (c) => {
      const { bow, usage } = await deps.getBow(owner(c), c.req.valid('param').id);
      setEtag(c, bow);
      return c.json({ ...bowToWire(bow), usage }, 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'patch',
      path: '/api/v1/bows/{id}',
      tags,
      summary: 'Edit some fields of a bow (null clears one)',
      request: { params: idParam, body: { required: true, content: json(updateBow) } },
      responses: { 200: { description: 'The bow, updated', content: json(bowSchema) } },
    }),
    async (c) => {
      const updated = await deps.updateBow(
        owner(c),
        c.req.valid('param').id,
        c.req.valid('json'),
        expectedVersion(c),
      );
      setEtag(c, updated);
      return c.json(bowToWire(updated), 200);
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
        path: `/api/v1/bows/{id}/${action}`,
        tags,
        summary: action === 'archive' ? 'Archive a bow' : 'Bring an archived bow back',
        request: { params: idParam },
        responses: { 200: { description: 'The bow', content: json(bowSchema) } },
      }),
      async (c) => {
        const changed = await deps.changeBowStatus(owner(c), c.req.valid('param').id, status);
        setEtag(c, changed);
        return c.json(bowToWire(changed), 200);
      },
      { auth: 'session' },
    );
  }

  registry.register(
    createRoute({
      method: 'delete',
      path: '/api/v1/bows/{id}',
      tags,
      summary: 'Delete a bow that no setup uses (soft delete)',
      request: { params: idParam },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      await deps.deleteBow(owner(c), c.req.valid('param').id, expectedVersion(c));
      return c.body(null, 204);
    },
    { auth: 'session' },
  );
}
