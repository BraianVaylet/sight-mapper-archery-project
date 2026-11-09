import { v7 as uuidv7 } from 'uuid';
import { expectForeign404, type Attack, type AttackContext } from '../helpers/isolation.js';

const ifMatch = { 'if-match': '"1"' };
const key = () => ({ 'idempotency-key': uuidv7() });
const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };

type Seeded = { setupId: string; arrowSetId: string; markId: string };

/** A setup of archer A with one mark at 40 m. */
async function seed({ call, userA }: AttackContext): Promise<Seeded> {
  const bowId = uuidv7();
  const sightId = uuidv7();
  const arrowSetId = uuidv7();
  const setupId = uuidv7();
  const markId = uuidv7();
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
    body: { id: setupId, bowId, sightId, arrowSetIds: [arrowSetId] },
    headers: key(),
  });
  await call(userA, 'POST', '/api/v1/marks', {
    body: { id: markId, setupId, arrowSetId, distanceM: 40, scaleValueMm: 16 },
    headers: key(),
  });
  return { setupId, arrowSetId, markId };
}

const marksOf = async ({ call, userA }: AttackContext, { setupId, arrowSetId }: Seeded) =>
  (
    (await (
      await call(userA, 'GET', `/api/v1/setups/${setupId}/marks?arrowSetId=${arrowSetId}`)
    ).json()) as { items: { id: string; scaleValueMm: number }[] }
  ).items;

/** Archer B against the marks of archer A: always 404, never the data, never a change. */
export const markAttacks: Attack[] = [
  {
    route: 'GET /api/v1/setups/{id}/marks',
    async run(context) {
      const { setupId, arrowSetId } = await seed(context);
      return expectForeign404(
        await context.call(
          context.userB,
          'GET',
          `/api/v1/setups/${setupId}/marks?arrowSetId=${arrowSetId}`,
        ),
      );
    },
  },
  {
    route: 'POST /api/v1/marks',
    async run(context) {
      const seeded = await seed(context);
      // B writes a mark into A's setup, naming A as the owner in the body.
      const answer = await context.call(context.userB, 'POST', '/api/v1/marks', {
        body: {
          id: uuidv7(),
          setupId: seeded.setupId,
          arrowSetId: seeded.arrowSetId,
          distanceM: 50,
          scaleValueMm: 20,
          userId: context.userA,
        },
        headers: key(),
      });
      const problem = await expectForeign404(answer);
      if (problem !== null) return problem;
      const mine = await marksOf(context, seeded);
      return mine.length === 1 ? null : "B wrote a mark into A's setup";
    },
  },
  {
    route: 'PATCH /api/v1/marks/{id}',
    async run(context) {
      const seeded = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'PATCH', `/api/v1/marks/${seeded.markId}`, {
          body: { scaleValueMm: 30 },
          headers: ifMatch,
        }),
      );
      if (problem !== null) return problem;
      const [mine] = await marksOf(context, seeded);
      return mine?.scaleValueMm === 16 ? null : "B changed A's mark";
    },
  },
  {
    route: 'DELETE /api/v1/marks/{id}',
    async run(context) {
      const seeded = await seed(context);
      const problem = await expectForeign404(
        await context.call(context.userB, 'DELETE', `/api/v1/marks/${seeded.markId}`, {
          headers: ifMatch,
        }),
      );
      if (problem !== null) return problem;
      return (await marksOf(context, seeded)).length === 1 ? null : "B deleted A's mark";
    },
  },
  {
    route: 'POST /api/v1/marks/{id}/restore',
    async run(context) {
      const seeded = await seed(context);
      await context.call(context.userA, 'DELETE', `/api/v1/marks/${seeded.markId}`, {
        headers: ifMatch,
      });
      const problem = await expectForeign404(
        await context.call(context.userB, 'POST', `/api/v1/marks/${seeded.markId}/restore`, {
          headers: key(),
        }),
      );
      if (problem !== null) return problem;
      return (await marksOf(context, seeded)).length === 0 ? null : "B undid A's delete";
    },
  },
];
