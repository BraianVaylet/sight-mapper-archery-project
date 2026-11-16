import { v7 as uuidv7 } from 'uuid';
import { expectForeign404, type Attack, type AttackContext } from '../helpers/isolation.js';

const ifMatch = { 'if-match': '"1"' };

/** A bow of archer A, ready to be attacked. */
async function seed({ call, userA }: AttackContext): Promise<string> {
  const id = uuidv7();
  await call(userA, 'POST', '/api/v1/bows', {
    body: { id, bowType: 'compound', manufacturer: 'Hoyt', model: 'Alpha' },
    headers: { 'idempotency-key': uuidv7() },
  });
  return id;
}

const bowOf = async ({ call, userA }: AttackContext, id: string) =>
  (await (await call(userA, 'GET', `/api/v1/bows/${id}`)).json()) as {
    manufacturer?: string;
    status?: string;
  };

/** Archer B against the bows of archer A: always 404, never the data, never a change. */
export const bowAttacks: Attack[] = [
  {
    route: 'GET /api/v1/bows',
    async run(context) {
      await seed(context);
      const { items } = (await (
        await context.call(context.userB, 'GET', '/api/v1/bows')
      ).json()) as { items: unknown[] };
      return items.length === 0 ? null : `B lists ${items.length} of A's bows`;
    },
  },
  {
    route: 'POST /api/v1/bows',
    async run(context) {
      const { call, userA, userB } = context;
      // A name for B in the body must not make the bow B's, and B reusing A's id must not read it.
      const id = uuidv7();
      await call(userA, 'POST', '/api/v1/bows', {
        body: { id, bowType: 'compound', model: 'Mine', userId: userB },
        headers: { 'idempotency-key': uuidv7() },
      });
      const theirs = (await (await call(userB, 'GET', '/api/v1/bows')).json()) as {
        items: { id: string }[];
      };
      if (theirs.items.some((bow) => bow.id === id)) return 'a userId in the body made B the owner';
      const clash = await call(userB, 'POST', '/api/v1/bows', {
        body: { id, bowType: 'compound', model: 'Other' },
        headers: { 'idempotency-key': uuidv7() },
      });
      const body = JSON.stringify(await clash.json());
      return body.includes('Mine') ? "the answer to B leaks A's bow" : null;
    },
  },
  {
    route: 'GET /api/v1/bows/{id}',
    async run(context) {
      const id = await seed(context);
      return expectForeign404(await context.call(context.userB, 'GET', `/api/v1/bows/${id}`));
    },
  },
  {
    route: 'PATCH /api/v1/bows/{id}',
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'PATCH', `/api/v1/bows/${id}`, {
          body: { manufacturer: 'Hijacked' },
          headers: ifMatch,
        }),
      );
      if (problem !== null) return problem;
      return (await bowOf(context, id)).manufacturer === 'Hoyt' ? null : 'B changed what A made';
    },
  },
  ...(['archive', 'unarchive'] as const).map((action): Attack => ({
    route: `POST /api/v1/bows/{id}/${action}`,
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'POST', `/api/v1/bows/${id}/${action}`, {
          headers: { 'idempotency-key': uuidv7() },
        }),
      );
      if (problem !== null) return problem;
      return (await bowOf(context, id)).status === 'active' ? null : 'B archived what A made';
    },
  })),
  {
    route: 'DELETE /api/v1/bows/{id}',
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'DELETE', `/api/v1/bows/${id}`, { headers: ifMatch }),
      );
      if (problem !== null) return problem;
      const still = await context.call(context.userA, 'GET', `/api/v1/bows/${id}`);
      return still.status === 200 ? null : 'B deleted what A made';
    },
  },
];
