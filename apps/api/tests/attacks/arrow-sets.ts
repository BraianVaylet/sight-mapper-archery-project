import { v7 as uuidv7 } from 'uuid';
import { expectForeign404, type Attack, type AttackContext } from '../helpers/isolation.js';

const ifMatch = { 'if-match': '"1"' };
const BASE = '/api/v1/arrow-sets';

/** A set of arrows of archer A, ready to be attacked. */
async function seed({ call, userA }: AttackContext): Promise<string> {
  const id = uuidv7();
  await call(userA, 'POST', BASE, {
    body: { id, name: 'Goldtip Hunter 400', spine: 400 },
    headers: { 'idempotency-key': uuidv7() },
  });
  return id;
}

const setOf = async ({ call, userA }: AttackContext, id: string) =>
  (await (await call(userA, 'GET', `${BASE}/${id}`)).json()) as { name?: string; status?: string };

/** Archer B against the arrow sets of archer A: always 404, never the data, never a change. */
export const arrowSetAttacks: Attack[] = [
  {
    route: `GET ${BASE}`,
    async run(context) {
      await seed(context);
      const { items } = (await (await context.call(context.userB, 'GET', BASE)).json()) as {
        items: unknown[];
      };
      return items.length === 0 ? null : `B lists ${items.length} of A's arrow sets`;
    },
  },
  {
    route: `POST ${BASE}`,
    async run({ call, userA, userB }) {
      // A name for B in the body must not make the set B's, and B reusing A's id must not read it.
      const id = uuidv7();
      await call(userA, 'POST', BASE, {
        body: { id, name: 'Mine', userId: userB },
        headers: { 'idempotency-key': uuidv7() },
      });
      const theirs = (await (await call(userB, 'GET', BASE)).json()) as { items: { id: string }[] };
      if (theirs.items.some((set) => set.id === id)) return 'a userId in the body made B the owner';
      const clash = await call(userB, 'POST', BASE, {
        body: { id, name: 'Other' },
        headers: { 'idempotency-key': uuidv7() },
      });
      return JSON.stringify(await clash.json()).includes('Mine')
        ? "the answer to B leaks A's arrow set"
        : null;
    },
  },
  {
    route: `GET ${BASE}/{id}`,
    async run(context) {
      const id = await seed(context);
      return expectForeign404(await context.call(context.userB, 'GET', `${BASE}/${id}`));
    },
  },
  {
    route: `PATCH ${BASE}/{id}`,
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'PATCH', `${BASE}/${id}`, {
          body: { name: 'Hijacked' },
          headers: ifMatch,
        }),
      );
      if (problem !== null) return problem;
      return (await setOf(context, id)).name === 'Goldtip Hunter 400'
        ? null
        : 'B changed what A made';
    },
  },
  ...(['archive', 'unarchive'] as const).map((action): Attack => ({
    route: `POST ${BASE}/{id}/${action}`,
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'POST', `${BASE}/${id}/${action}`, {
          headers: { 'idempotency-key': uuidv7() },
        }),
      );
      if (problem !== null) return problem;
      return (await setOf(context, id)).status === 'active' ? null : 'B archived what A made';
    },
  })),
  {
    route: `DELETE ${BASE}/{id}`,
    async run(context) {
      const id = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'DELETE', `${BASE}/${id}`, { headers: ifMatch }),
      );
      if (problem !== null) return problem;
      const still = await context.call(context.userA, 'GET', `${BASE}/${id}`);
      return still.status === 200 ? null : 'B deleted what A made';
    },
  },
];
