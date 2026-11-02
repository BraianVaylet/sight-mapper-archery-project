import { v7 as uuidv7 } from 'uuid';
import { expectForeign404, type Attack, type AttackContext } from '../helpers/isolation.js';

const ifMatch = { 'if-match': '"1"' };
const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };

/** A sight of archer A, ready to be attacked. */
async function seed({ call, userA }: AttackContext): Promise<string> {
  const id = uuidv7();
  await call(userA, 'POST', '/api/v1/sights', {
    body: {
      id,
      pinType: 'monopin',
      manufacturer: 'Sight Master',
      model: 'Ultraview',
      scale: SCALE,
    },
    headers: { 'idempotency-key': uuidv7() },
  });
  return id;
}

const sightOf = async ({ call, userA }: AttackContext, id: string) =>
  (await (await call(userA, 'GET', `/api/v1/sights/${id}`)).json()) as {
    manufacturer?: string;
    status?: string;
  };

/** Archer B against the sights of archer A: always 404, never the data, never a change. */
export const sightAttacks: Attack[] = [
  {
    route: 'GET /api/v1/sights',
    async run(context) {
      await seed(context);
      const { items } = (await (
        await context.call(context.userB, 'GET', '/api/v1/sights')
      ).json()) as { items: unknown[] };
      return items.length === 0 ? null : `B lists ${items.length} of A's sights`;
    },
  },
  {
    route: 'POST /api/v1/sights',
    async run(context) {
      const { call, userA, userB } = context;
      // A name for B in the body must not make the sight B's, and B reusing A's id must not read it.
      const id = uuidv7();
      await call(userA, 'POST', '/api/v1/sights', {
        body: { id, pinType: 'monopin', model: 'Mine', scale: SCALE, userId: userB },
        headers: { 'idempotency-key': uuidv7() },
      });
      const theirs = (await (await call(userB, 'GET', '/api/v1/sights')).json()) as {
        items: { id: string }[];
      };
      if (theirs.items.some((sight) => sight.id === id))
        return 'a userId in the body made B the owner';
      const clash = await call(userB, 'POST', '/api/v1/sights', {
        body: { id, pinType: 'monopin', model: 'Other', scale: SCALE },
        headers: { 'idempotency-key': uuidv7() },
      });
      const body = JSON.stringify(await clash.json());
      return body.includes('Mine') ? "the answer to B leaks A's sight" : null;
    },
  },
  {
    route: 'GET /api/v1/sights/{id}',
    async run(context) {
      const id = await seed(context);
      return expectForeign404(await context.call(context.userB, 'GET', `/api/v1/sights/${id}`));
    },
  },
  {
    route: 'PATCH /api/v1/sights/{id}',
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'PATCH', `/api/v1/sights/${id}`, {
          body: { manufacturer: 'Hijacked' },
          headers: ifMatch,
        }),
      );
      if (problem !== null) return problem;
      return (await sightOf(context, id)).manufacturer === 'Sight Master'
        ? null
        : 'B changed what A made';
    },
  },
  ...(['archive', 'unarchive'] as const).map((action): Attack => ({
    route: `POST /api/v1/sights/{id}/${action}`,
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'POST', `/api/v1/sights/${id}/${action}`, {
          headers: { 'idempotency-key': uuidv7() },
        }),
      );
      if (problem !== null) return problem;
      return (await sightOf(context, id)).status === 'active' ? null : 'B archived what A made';
    },
  })),
  {
    route: 'DELETE /api/v1/sights/{id}',
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'DELETE', `/api/v1/sights/${id}`, { headers: ifMatch }),
      );
      if (problem !== null) return problem;
      const still = await context.call(context.userA, 'GET', `/api/v1/sights/${id}`);
      return still.status === 200 ? null : 'B deleted what A made';
    },
  },
];
