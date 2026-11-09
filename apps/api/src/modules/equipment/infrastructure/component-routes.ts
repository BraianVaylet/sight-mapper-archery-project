import { createRoute, z } from '@hono/zod-openapi';
import { listQuery, page, uuidv7, type ComponentUsage } from '@sight-mapper/schemas';
import type { ComponentStatus } from '@sight-mapper/types';
import type { Context } from 'hono';
import { expectedVersion, setEtag } from '../../../core/concurrency/concurrency.js';
import type { AppBindings } from '../../../core/http/context.js';
import { AppError } from '../../../core/http/errors.js';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { ComponentMeta, ComponentPage, ComponentQuery } from '../domain/component.js';

export type ComponentRoutes<E extends ComponentMeta, Create, Patch> = {
  /** `/api/v1/arrow-sets` */
  readonly path: string;
  /** For the summaries: `'arrow set'`. */
  readonly noun: string;
  readonly item: z.ZodType;
  readonly detail: z.ZodType;
  readonly create: z.ZodType<Create>;
  readonly update: z.ZodType<Patch>;
  readonly handlers: {
    list(userId: string, query: ComponentQuery): Promise<ComponentPage<E>>;
    get(userId: string, id: string): Promise<{ entity: E; usage: ComponentUsage }>;
    create(userId: string, input: Create): Promise<E>;
    update(userId: string, id: string, patch: Patch, expectedVersion: number): Promise<E>;
    changeStatus(userId: string, id: string, status: ComponentStatus): Promise<E>;
    remove(userId: string, id: string, expectedVersion: number): Promise<void>;
  };
};

const json = <S extends z.ZodType>(schema: S) => ({ 'application/json': { schema } });
const idParam = z.object({ id: uuidv7 });

/** Who is calling comes from the session, never from the body, the query or the path. */
function owner(c: Context<AppBindings>): string {
  const userId = c.get('userId');
  if (userId === undefined) throw new AppError('SM-CORE-401-001');
  return userId;
}

/** A component as it goes on the wire: ISO instants, no user id (ADR-000). */
export function componentToWire<E extends ComponentMeta>(entity: E): Record<string, unknown> {
  const { createdAt, updatedAt, deletedAt, ...rest } = entity;
  return {
    ...rest,
    // Left out of the JSON: the owner is the session's, and the client never needs it.
    userId: undefined,
    createdAt: createdAt.toString(),
    updatedAt: updatedAt.toString(),
    deletedAt: deletedAt === null ? null : deletedAt.toString(),
  };
}

/**
 * The seven routes of a kind of equipment (TECNICO §5.3), registered once. Zod's response
 * types are not threaded through here: the schemas document the answer, the handlers build it.
 */
export function registerComponentRoutes<E extends ComponentMeta, Create, Patch>(
  registry: RouteRegistry,
  config: ComponentRoutes<E, Create, Patch>,
): void {
  const { path, noun, handlers } = config;
  const tags = ['equipment'];
  const withId = `${path}/{id}`;

  registry.register(
    createRoute({
      method: 'get',
      path,
      tags,
      summary: `List ${noun}s (active unless asked otherwise), newest edit first`,
      request: { query: listQuery },
      responses: { 200: { description: `A page of ${noun}s`, content: json(page(config.item)) } },
    }),
    (async (c: Context<AppBindings>) => {
      const result = await handlers.list(
        owner(c),
        (c.req as never as { valid(t: string): ComponentQuery }).valid('query'),
      );
      return c.json(
        { items: result.items.map(componentToWire), nextCursor: result.nextCursor },
        200,
      );
    }) as never,
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'post',
      path,
      tags,
      summary: `Add a ${noun} (the id is made by the client)`,
      request: { body: { required: true, content: json(config.create) } },
      responses: { 201: { description: `The ${noun}`, content: json(config.item) } },
    }),
    (async (c: Context<AppBindings>) => {
      const created = await handlers.create(
        owner(c),
        (c.req as never as { valid(t: string): Create }).valid('json'),
      );
      setEtag(c, created);
      return c.json(componentToWire(created), 201);
    }) as never,
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'get',
      path: withId,
      tags,
      summary: `A ${noun} and how many setups and marks use it`,
      request: { params: idParam },
      responses: { 200: { description: `The ${noun}`, content: json(config.detail) } },
    }),
    (async (c: Context<AppBindings>) => {
      const { id } = (c.req as never as { valid(t: string): { id: string } }).valid('param');
      const { entity, usage } = await handlers.get(owner(c), id);
      setEtag(c, entity);
      return c.json({ ...componentToWire(entity), usage }, 200);
    }) as never,
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'patch',
      path: withId,
      tags,
      summary: `Edit some fields of a ${noun} (null clears one)`,
      request: { params: idParam, body: { required: true, content: json(config.update) } },
      responses: { 200: { description: `The ${noun}, updated`, content: json(config.item) } },
    }),
    (async (c: Context<AppBindings>) => {
      const valid = c.req as never as { valid(t: string): never };
      const { id } = valid.valid('param') as { id: string };
      const updated = await handlers.update(
        owner(c),
        id,
        valid.valid('json') as Patch,
        expectedVersion(c),
      );
      setEtag(c, updated);
      return c.json(componentToWire(updated), 200);
    }) as never,
    { auth: 'session' },
  );

  for (const [action, status] of [
    ['archive', 'archived'],
    ['unarchive', 'active'],
  ] as const) {
    registry.register(
      createRoute({
        method: 'post',
        path: `${withId}/${action}`,
        tags,
        summary: action === 'archive' ? `Archive a ${noun}` : `Bring an archived ${noun} back`,
        request: { params: idParam },
        responses: { 200: { description: `The ${noun}`, content: json(config.item) } },
      }),
      (async (c: Context<AppBindings>) => {
        const { id } = (c.req as never as { valid(t: string): { id: string } }).valid('param');
        const changed = await handlers.changeStatus(owner(c), id, status);
        setEtag(c, changed);
        return c.json(componentToWire(changed), 200);
      }) as never,
      { auth: 'session' },
    );
  }

  registry.register(
    createRoute({
      method: 'delete',
      path: withId,
      tags,
      summary: `Delete a ${noun} that no setup uses (soft delete)`,
      request: { params: idParam },
      responses: { 204: { description: 'Deleted' } },
    }),
    (async (c: Context<AppBindings>) => {
      const { id } = (c.req as never as { valid(t: string): { id: string } }).valid('param');
      await handlers.remove(owner(c), id, expectedVersion(c));
      return c.body(null, 204);
    }) as never,
    { auth: 'session' },
  );
}
