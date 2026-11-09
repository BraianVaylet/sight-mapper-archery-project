import { v7 as uuidv7 } from 'uuid';
import { expectForeign404, type Attack, type AttackContext } from '../helpers/isolation.js';

const ifMatch = { 'if-match': '"1"' };
const key = () => ({ 'idempotency-key': uuidv7() });
const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };

type Seeded = { setupId: string; bowId: string; sightId: string; arrowSetId: string };

/** A complete setup of archer A: bow, sight, arrow set and the setup that joins them. */
async function seed({ call, userA }: AttackContext): Promise<Seeded> {
  const bowId = uuidv7();
  const sightId = uuidv7();
  const arrowSetId = uuidv7();
  const setupId = uuidv7();
  await call(userA, 'POST', '/api/v1/bows', {
    body: { id: bowId, bowType: 'compound', model: 'Alpha' },
    headers: key(),
  });
  await call(userA, 'POST', '/api/v1/sights', {
    body: { id: sightId, model: 'Ultraview', scale: SCALE },
    headers: key(),
  });
  await call(userA, 'POST', '/api/v1/arrow-sets', {
    body: { id: arrowSetId, name: 'Hunter 400' },
    headers: key(),
  });
  await call(userA, 'POST', '/api/v1/setups', {
    body: { id: setupId, bowId, sightId, arrowSetIds: [arrowSetId], name: 'Mine' },
    headers: key(),
  });
  return { setupId, bowId, sightId, arrowSetId };
}

const setupOf = async ({ call, userA }: AttackContext, id: string) =>
  (await (await call(userA, 'GET', `/api/v1/setups/${id}`)).json()) as {
    name?: string;
    status?: string;
    isFavorite?: boolean;
  };

/** Archer B against the setups of archer A: always 404, never the data, never a change. */
export const setupAttacks: Attack[] = [
  {
    route: 'GET /api/v1/setups',
    async run(context) {
      await seed(context);
      const { items } = (await (
        await context.call(context.userB, 'GET', '/api/v1/setups')
      ).json()) as { items: unknown[] };
      return items.length === 0 ? null : `B lists ${items.length} of A's setups`;
    },
  },
  {
    route: 'GET /api/v1/setups/trash',
    async run(context) {
      const { setupId } = await seed(context);
      await context.call(context.userA, 'DELETE', `/api/v1/setups/${setupId}`, {
        headers: ifMatch,
      });
      const { items } = (await (
        await context.call(context.userB, 'GET', '/api/v1/setups/trash')
      ).json()) as { items: unknown[] };
      return items.length === 0 ? null : `B sees ${items.length} of A's trashed setups`;
    },
  },
  {
    route: 'POST /api/v1/setups',
    async run(context) {
      const { call, userB } = context;
      const mine = await seed(context);
      // B builds a setup out of A's bow, sight and arrows: none of them is B's.
      const answer = await call(userB, 'POST', '/api/v1/setups', {
        body: {
          id: uuidv7(),
          bowId: mine.bowId,
          sightId: mine.sightId,
          arrowSetIds: [mine.arrowSetId],
          userId: context.userA,
        },
        headers: key(),
      });
      if (answer.status !== 422) return `B built a setup from A's equipment (${answer.status})`;
      const body = (await answer.json()) as { error: { code: string } };
      if (body.error.code !== 'SM-STP-422-001') return `unexpected answer ${body.error.code}`;
      const theirs = (await (await call(userB, 'GET', '/api/v1/setups')).json()) as {
        items: unknown[];
      };
      return theirs.items.length === 0 ? null : 'a setup was made for B anyway';
    },
  },
  {
    route: 'GET /api/v1/setups/{id}',
    async run(context) {
      const { setupId } = await seed(context);
      return expectForeign404(
        await context.call(context.userB, 'GET', `/api/v1/setups/${setupId}`),
      );
    },
  },
  {
    route: 'PATCH /api/v1/setups/{id}',
    async run(context) {
      const { setupId } = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'PATCH', `/api/v1/setups/${setupId}`, {
          body: { name: 'Hijacked', isFavorite: true },
          headers: ifMatch,
        }),
      );
      if (problem !== null) return problem;
      const own = await setupOf(context, setupId);
      return own.name === 'Mine' && own.isFavorite === false ? null : 'B changed what A made';
    },
  },
  ...(['archive', 'unarchive'] as const).map((action): Attack => ({
    route: `POST /api/v1/setups/{id}/${action}`,
    async run(context) {
      const { setupId } = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'POST', `/api/v1/setups/${setupId}/${action}`, {
          headers: key(),
        }),
      );
      if (problem !== null) return problem;
      return (await setupOf(context, setupId)).status === 'active'
        ? null
        : 'B archived what A made';
    },
  })),
  {
    route: 'DELETE /api/v1/setups/{id}',
    async run(context) {
      const { setupId } = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'DELETE', `/api/v1/setups/${setupId}`, {
          headers: ifMatch,
        }),
      );
      if (problem !== null) return problem;
      const still = await context.call(context.userA, 'GET', `/api/v1/setups/${setupId}`);
      return still.status === 200 ? null : 'B deleted what A made';
    },
  },
  {
    route: 'POST /api/v1/setups/{id}/restore',
    async run(context) {
      const { setupId } = await seed(context);
      await context.call(context.userA, 'DELETE', `/api/v1/setups/${setupId}`, {
        headers: ifMatch,
      });
      const problem = await expectForeign404(
        await context.call(context.userB, 'POST', `/api/v1/setups/${setupId}/restore`, {
          headers: key(),
        }),
      );
      if (problem !== null) return problem;
      const mine = (await (
        await context.call(context.userA, 'GET', '/api/v1/setups/trash')
      ).json()) as {
        items: { id: string }[];
      };
      return mine.items.some((setup) => setup.id === setupId) ? null : 'B took A out of the trash';
    },
  },
];
