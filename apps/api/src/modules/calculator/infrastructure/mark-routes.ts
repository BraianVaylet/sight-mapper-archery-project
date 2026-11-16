import { createRoute, z } from '@hono/zod-openapi';
import {
  createMark,
  listMarksQuery,
  mark as markSchema,
  updateMark,
  uuidv7,
} from '@sight-mapper/schemas';
import type { Context } from 'hono';
import { expectedVersion, setEtag } from '../../../core/concurrency/concurrency.js';
import type { AppBindings } from '../../../core/http/context.js';
import { AppError } from '../../../core/http/errors.js';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { createCreateMark } from '../application/create-mark.js';
import type { MarkUseCases } from '../application/mark-use-cases.js';
import type { createUpdateMark } from '../application/update-mark.js';
import type { Mark } from '../domain/mark.js';

export type MarkRoutesDeps = {
  readonly shared: MarkUseCases;
  readonly create: ReturnType<typeof createCreateMark>;
  readonly update: ReturnType<typeof createUpdateMark>;
};

const json = <S extends z.ZodType>(schema: S) => ({ 'application/json': { schema } });
const idParam = z.object({ id: uuidv7 });

/** Who is calling comes from the session, never from the body, the query or the path. */
function owner(c: Context<AppBindings>): string {
  const userId = c.get('userId');
  if (userId === undefined) throw new AppError('SM-CORE-401-001');
  return userId;
}

/** A mark as it goes on the wire: ISO instants, no user id (ADR-000). */
export function markToWire(mark: Mark) {
  return {
    id: mark.id,
    version: mark.version,
    createdAt: mark.createdAt.toString(),
    updatedAt: mark.updatedAt.toString(),
    deletedAt: mark.deletedAt === null ? null : mark.deletedAt.toString(),
    setupId: mark.setupId,
    arrowSetId: mark.arrowSetId,
    distanceM: mark.distanceM,
    scaleValueMm: mark.scaleValueMm,
    origin: mark.origin,
    ...(mark.note == null ? {} : { note: mark.note }),
    measuredAt: mark.measuredAt.toString(),
  };
}

/** `/api/v1/marks` and the marks of a setup (TECNICO §5.4). */
export function registerMarkRoutes(registry: RouteRegistry, deps: MarkRoutesDeps): void {
  const tags = ['calculator'];
  const { shared } = deps;

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/setups/{id}/marks',
      tags,
      summary: 'Every live mark of one (setup, arrow set) pair, nearest first (at most 500)',
      request: { params: idParam, query: listMarksQuery },
      responses: {
        200: {
          description: 'The marks of the pair',
          content: json(z.object({ items: z.array(markSchema) })),
        },
      },
    }),
    async (c) => {
      const items = await shared.listByPair(
        owner(c),
        c.req.valid('param').id,
        c.req.valid('query').arrowSetId,
      );
      return c.json({ items: items.map(markToWire) }, 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/marks',
      tags,
      summary:
        'Record a mark (the id is made by the client); `replace: true` takes over a distance',
      request: { body: { required: true, content: json(createMark) } },
      responses: {
        201: { description: 'The mark', content: json(markSchema) },
        200: { description: 'The existing mark, replaced', content: json(markSchema) },
      },
    }),
    async (c) => {
      const { mark, replaced } = await deps.create(owner(c), c.req.valid('json'));
      setEtag(c, mark);
      return c.json(markToWire(mark), replaced ? 200 : 201);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'patch',
      path: '/api/v1/marks/{id}',
      tags,
      summary: 'Edit the distance, reading, note or date of a mark',
      request: { params: idParam, body: { required: true, content: json(updateMark) } },
      responses: { 200: { description: 'The mark, updated', content: json(markSchema) } },
    }),
    async (c) => {
      const updated = await deps.update(
        owner(c),
        c.req.valid('param').id,
        c.req.valid('json'),
        expectedVersion(c),
      );
      setEtag(c, updated);
      return c.json(markToWire(updated), 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'delete',
      path: '/api/v1/marks/{id}',
      tags,
      summary: 'Delete a mark (soft: it can be undone for 30 days)',
      request: { params: idParam },
      responses: { 204: { description: 'Deleted' } },
    }),
    async (c) => {
      await shared.remove(owner(c), c.req.valid('param').id, expectedVersion(c));
      return c.body(null, 204);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/marks/{id}/restore',
      tags,
      summary: 'Undo a delete (within 30 days)',
      request: { params: idParam },
      responses: { 200: { description: 'The mark', content: json(markSchema) } },
    }),
    async (c) => {
      const restored = await shared.restore(owner(c), c.req.valid('param').id);
      setEtag(c, restored);
      return c.json(markToWire(restored), 200);
    },
    { auth: 'session' },
  );
}
