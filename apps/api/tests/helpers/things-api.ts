import { createRoute, z } from '@hono/zod-openapi';
import { createContainer } from '../../src/composition-root.js';
import { fixedClock } from '../../src/core/clock/clock.js';
import { AppError } from '../../src/core/http/errors.js';
import { createLogger } from '../../src/core/logger/logger.js';
import { fakeSession, testEnv } from './app.js';
import type { Attack } from './isolation.js';

type Thing = { id: string; name: string; version: number };

const thing = z.object({ id: z.string(), name: z.string(), version: z.number() });
const json = <S extends z.ZodType>(schema: S) => ({ 'application/json': { schema } });

/**
 * A small API with the shape of every resource of the product (create, list, read, edit, delete),
 * to prove the isolation suite. `scoped` keeps each archer's things apart; `leaky` has the classic
 * bug, one table for everybody, so the suite must catch it.
 */
export function buildThingsApi(mode: 'scoped' | 'leaky') {
  const byUser = new Map<string, Map<string, Thing>>();
  const shared = new Map<string, Thing>();
  const tableOf = (userId: string) => {
    if (mode === 'leaky') return shared;
    let table = byUser.get(userId);
    if (table === undefined) byUser.set(userId, (table = new Map()));
    return table;
  };
  const owner = (userId: string | undefined): string => {
    if (userId === undefined) throw new AppError('SM-CORE-401-001');
    return userId;
  };

  const container = createContainer({
    env: testEnv,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock('2026-11-01T12:00:00Z'),
    session: fakeSession,
  });
  const { registry } = container;
  const notFound = () => new AppError('SM-CORE-404-002', { resource: 'thing' });

  registry.register(
    createRoute({
      method: 'post',
      path: '/api/v1/things',
      request: { body: { content: json(z.object({ id: z.string(), name: z.string() })) } },
      responses: { 201: { description: 'created', content: json(thing) } },
    }),
    (c) => {
      // The body may carry any extra field (a userId, say): the owner is the session, only.
      const input = c.req.valid('json');
      const created = { id: input.id, name: input.name, version: 1 };
      tableOf(owner(c.get('userId'))).set(created.id, created);
      return c.json(created, 201);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/things',
      responses: {
        200: { description: 'ok', content: json(z.object({ items: z.array(thing) })) },
      },
    }),
    (c) => c.json({ items: [...tableOf(owner(c.get('userId'))).values()] }, 200),
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/things/{id}',
      request: { params: z.object({ id: z.string() }) },
      responses: { 200: { description: 'ok', content: json(thing) } },
    }),
    (c) => {
      const found = tableOf(owner(c.get('userId'))).get(c.req.valid('param').id);
      if (found === undefined) throw notFound();
      return c.json(found, 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'patch',
      path: '/api/v1/things/{id}',
      request: {
        params: z.object({ id: z.string() }),
        body: { content: json(z.object({ name: z.string() })) },
      },
      responses: { 200: { description: 'ok', content: json(thing) } },
    }),
    (c) => {
      const found = tableOf(owner(c.get('userId'))).get(c.req.valid('param').id);
      if (found === undefined) throw notFound();
      found.name = c.req.valid('json').name;
      found.version += 1;
      return c.json(found, 200);
    },
    { auth: 'session' },
  );

  registry.register(
    createRoute({
      method: 'delete',
      path: '/api/v1/things/{id}',
      request: { params: z.object({ id: z.string() }) },
      responses: { 204: { description: 'deleted' } },
    }),
    (c) => {
      const table = tableOf(owner(c.get('userId')));
      const id = c.req.valid('param').id;
      if (!table.has(id)) throw notFound();
      table.delete(id);
      return c.body(null, 204);
    },
    { auth: 'session' },
  );

  return { ...container, byUser, shared };
}

/** The attacks for the five routes above: what archer B tries against what archer A made. */
export function thingsAttacks(expectForeign404: (r: Response) => Promise<string | null>): Attack[] {
  const seed = async (
    call: Parameters<Attack['run']>[0]['call'],
    user: string,
    id: string,
  ): Promise<void> => {
    await call(user, 'POST', '/api/v1/things', { body: { id, name: 'mine' } });
  };
  const ifMatch = { 'if-match': '"1"' };

  return [
    {
      route: 'POST /api/v1/things',
      async run({ call, userA, userB }) {
        // A names B as the owner in the body: the thing must still be A's and never show up for B.
        await call(userA, 'POST', '/api/v1/things', {
          body: { id: 'forged', name: 'x', userId: userB },
        });
        const mine = (await (await call(userA, 'GET', '/api/v1/things')).json()) as {
          items: { id: string }[];
        };
        const theirs = (await (await call(userB, 'GET', '/api/v1/things')).json()) as {
          items: { id: string }[];
        };
        if (!mine.items.some((t) => t.id === 'forged'))
          return 'the creator does not see their own thing';
        return theirs.items.some((t) => t.id === 'forged')
          ? 'a userId in the body made B the owner'
          : null;
      },
    },
    {
      route: 'GET /api/v1/things',
      async run({ call, userA, userB }) {
        await seed(call, userA, 'listed');
        const items = (
          (await (await call(userB, 'GET', '/api/v1/things')).json()) as { items: unknown[] }
        ).items;
        return items.length === 0 ? null : `B lists ${items.length} of A's things`;
      },
    },
    {
      route: 'GET /api/v1/things/{id}',
      async run({ call, userA, userB }) {
        await seed(call, userA, 'read');
        return expectForeign404(await call(userB, 'GET', '/api/v1/things/read'));
      },
    },
    {
      route: 'PATCH /api/v1/things/{id}',
      async run({ call, userA, userB }) {
        await seed(call, userA, 'patched');
        const problem = await expectForeign404(
          await call(userB, 'PATCH', '/api/v1/things/patched', {
            body: { name: 'hijacked' },
            headers: ifMatch,
          }),
        );
        if (problem !== null) return problem;
        const own = (await (await call(userA, 'GET', '/api/v1/things/patched')).json()) as {
          name: string;
        };
        return own.name === 'mine' ? null : 'B changed what A made';
      },
    },
    {
      route: 'DELETE /api/v1/things/{id}',
      async run({ call, userA, userB }) {
        await seed(call, userA, 'deleted');
        const problem = await expectForeign404(
          await call(userB, 'DELETE', '/api/v1/things/deleted', { headers: ifMatch }),
        );
        if (problem !== null) return problem;
        const still = await call(userA, 'GET', '/api/v1/things/deleted');
        return still.status === 200 ? null : 'B deleted what A made';
      },
    },
  ];
}
