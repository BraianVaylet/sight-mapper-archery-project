import { createRoute, z } from '@hono/zod-openapi';
import {
  createSetup,
  listQuery,
  page,
  setupView,
  trashedSetupView,
  updateSetup,
  uuidv7,
  type SetupView,
} from '@sight-mapper/schemas';
import type { Context } from 'hono';
import { expectedVersion, setEtag } from '../../../core/concurrency/concurrency.js';
import type { AppBindings } from '../../../core/http/context.js';
import { AppError } from '../../../core/http/errors.js';
import type { RouteRegistry } from '../../../core/registry/registry.js';
import type { createCreateSetup } from '../application/create-setup.js';
import type { SetupUseCases } from '../application/setup-use-cases.js';
import { purgeAt } from '../application/setup-use-cases.js';
import type { SetupViews } from '../application/setup-views.js';
import type { createUpdateSetup } from '../application/update-setup.js';
import type { Setup } from '../domain/setup.js';

export type SetupRoutesDeps = {
  readonly shared: SetupUseCases;
  readonly views: SetupViews;
  readonly create: ReturnType<typeof createCreateSetup>;
  readonly update: ReturnType<typeof createUpdateSetup>;
};

const json = <S extends z.ZodType>(schema: S) => ({ 'application/json': { schema } });
const idParam = z.object({ id: uuidv7 });

/** Who is calling comes from the session, never from the body, the query or the path. */
function owner(c: Context<AppBindings>): string {
  const userId = c.get('userId');
  if (userId === undefined) throw new AppError('SM-CORE-401-001');
  return userId;
}

/** `/api/v1/setups`: the Home, the setup screen's data, and the trash (TECNICO §5.4). */
export function registerSetupRoutes(registry: RouteRegistry, deps: SetupRoutesDeps): void {
  const tags = ['calculator'];
  const { shared, views } = deps;

  /** One setup as the app reads it, with its equipment. */
  async function viewOf(userId: string, setup: Setup): Promise<SetupView> {
    const [view] = await views(userId, [setup]);
    if (view === undefined) throw new AppError('SM-CORE-404-002', { resource: 'setup' });
    return view;
  }

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/setups',
      tags,
      summary: 'The Home: favourites first, then the latest edit',
      request: { query: listQuery },
      responses: {
        200: { description: 'A page of setups', content: json(page(setupView)) },
      },
    }),
    async (c) => {
      const userId = owner(c);
      const result = await shared.list(userId, c.req.valid('query'));
      return c.json(
        { items: await views(userId, result.items), nextCursor: result.nextCursor },
        200,
      );
    },
    { auth: 'session' },
  );

  // Before `/{id}`: "trash" is not an id.
  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/setups/trash',
      tags,
      summary: 'The trash: deleted setups and when each is purged',
      responses: {
        200: {
          description: 'Setups in the trash',
          content: json(z.object({ items: z.array(trashedSetupView) })),
        },
      },
    }),
    async (c) => {
      const userId = owner(c);
      const trashed = await shared.listTrash(userId);
      const shown = await views(userId, trashed);
      const byId = new Map(trashed.map((setup) => [setup.id, setup]));
      return c.json(
        {
          items: shown.flatMap((view) => {
            const deletedAt = byId.get(view.id)?.deletedAt;
            // Everything in the trash has a `deletedAt`; the guard is for the types.
            return deletedAt == null ? [] : [{ ...view, purgeAt: purgeAt(deletedAt).toString() }];
          }),
        },
        200,
      );
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/setups',
      tags,
      summary: 'Create a setup (the id is made by the client)',
      request: { body: { required: true, content: json(createSetup) } },
      responses: { 201: { description: 'The setup', content: json(setupView) } },
    }),
    async (c) => {
      const userId = owner(c);
      const created = await deps.create(userId, c.req.valid('json'));
      setEtag(c, created);
      return c.json(await viewOf(userId, created), 201);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/setups/{id}',
      tags,
      summary: 'A setup with its bow, sight (and scale) and arrow sets',
      request: { params: idParam },
      responses: { 200: { description: 'The setup', content: json(setupView) } },
    }),
    async (c) => {
      const userId = owner(c);
      const setup = await shared.get(userId, c.req.valid('param').id);
      setEtag(c, setup);
      return c.json(await viewOf(userId, setup), 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'patch',
      path: '/api/v1/setups/{id}',
      tags,
      summary: 'Rename, favourite, or change the arrow sets of a setup',
      request: { params: idParam, body: { required: true, content: json(updateSetup) } },
      responses: { 200: { description: 'The setup, updated', content: json(setupView) } },
    }),
    async (c) => {
      const userId = owner(c);
      const updated = await deps.update(
        userId,
        c.req.valid('param').id,
        c.req.valid('json'),
        expectedVersion(c),
      );
      setEtag(c, updated);
      return c.json(await viewOf(userId, updated), 200);
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
        path: `/api/v1/setups/{id}/${action}`,
        tags,
        summary: action === 'archive' ? 'Archive a setup' : 'Bring an archived setup back',
        request: { params: idParam },
        responses: { 200: { description: 'The setup', content: json(setupView) } },
      }),
      async (c) => {
        const userId = owner(c);
        const changed = await shared.changeStatus(userId, c.req.valid('param').id, status);
        setEtag(c, changed);
        return c.json(await viewOf(userId, changed), 200);
      },
      { auth: 'session' },
    );
  }

  registry.register(
    createRoute({
      method: 'delete',
      path: '/api/v1/setups/{id}',
      tags,
      summary: 'Send a setup to the trash (restorable for 30 days)',
      request: { params: idParam },
      responses: { 204: { description: 'In the trash' } },
    }),
    async (c) => {
      await shared.moveToTrash(owner(c), c.req.valid('param').id, expectedVersion(c));
      return c.body(null, 204);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/setups/{id}/restore',
      tags,
      summary: 'Take a setup out of the trash (within 30 days)',
      request: { params: idParam },
      responses: { 200: { description: 'The setup', content: json(setupView) } },
    }),
    async (c) => {
      const userId = owner(c);
      const restored = await shared.restore(userId, c.req.valid('param').id);
      setEtag(c, restored);
      return c.json(await viewOf(userId, restored), 200);
    },
    { auth: 'session' },
  );
}
