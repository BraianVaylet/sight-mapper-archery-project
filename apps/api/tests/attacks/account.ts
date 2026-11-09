import { v7 as uuidv7 } from 'uuid';
import { expectForeign404, type Attack, type AttackContext } from '../helpers/isolation.js';

const ifMatch = (version: number) => ({ 'if-match': `"${version}"` });
const key = () => ({ 'idempotency-key': uuidv7() });
const theme = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { theme?: unknown }).theme;
const versionOf = async (response: Response): Promise<number> =>
  ((await response.json()) as { version: number }).version;
const quickAccessOf = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { quickAccess?: unknown }).quickAccess;

/** A complete setup of archer A: bow, sight, arrow set and the setup that joins them. */
async function seedSetupOfA({ call, userA }: AttackContext) {
  const bowId = uuidv7();
  const sightId = uuidv7();
  const arrowSetId = uuidv7();
  const setupId = uuidv7();
  await call(userA, 'POST', '/api/v1/bows', {
    body: { id: bowId, bowType: 'compound', model: 'Alpha' },
    headers: key(),
  });
  await call(userA, 'POST', '/api/v1/sights', {
    body: {
      id: sightId,
      model: 'Ultraview',
      scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
    },
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
  return { setupId, arrowSetId };
}

/** Archer B against what archer A did to their own profile (the profile has no id to guess). */
export const accountAttacks: Attack[] = [
  {
    route: 'GET /api/v1/me',
    async run({ call, userA, userB }) {
      await call(userA, 'GET', '/api/v1/me');
      await call(userA, 'PATCH', '/api/v1/me/preferences', {
        body: { theme: 'dark' },
        headers: ifMatch(1),
      });
      const seen = await theme(await call(userB, 'GET', '/api/v1/me'));
      return seen === 'dark' ? "B reads A's preferences" : null;
    },
  },
  {
    route: 'PATCH /api/v1/me/preferences',
    async run({ call, userA, userB }) {
      await call(userA, 'GET', '/api/v1/me');
      await call(userB, 'GET', '/api/v1/me');
      // B names A as the owner in the body, and hits the version A's profile has too.
      const answer = await call(userB, 'PATCH', '/api/v1/me/preferences', {
        body: { theme: 'light', userId: userA },
        headers: ifMatch(1),
      });
      if (answer.status !== 200) return `B could not change their own profile (${answer.status})`;
      const mine = await theme(await call(userA, 'GET', '/api/v1/me'));
      return mine === 'light' ? "B changed A's preferences" : null;
    },
  },
  {
    route: 'PUT /api/v1/me/quick-access',
    async run(context) {
      const { call, userA, userB } = context;
      const { setupId, arrowSetId } = await seedSetupOfA(context);
      const versionB = await versionOf(await call(userB, 'GET', '/api/v1/me'));
      // B points their quick access at A's setup: it is "not found", like a setup that is not there.
      const answer = await call(userB, 'PUT', '/api/v1/me/quick-access', {
        body: { setupId, arrowSetId },
        headers: ifMatch(versionB),
      });
      const problem = await expectForeign404(answer);
      if (problem !== null) return problem;
      if ((await quickAccessOf(await call(userB, 'GET', '/api/v1/me'))) !== null) {
        return "B's quick access points at A's setup";
      }
      // And A can set their own: the same call, the same body, from the owner.
      const versionA = await versionOf(await call(userA, 'GET', '/api/v1/me'));
      const mine = await call(userA, 'PUT', '/api/v1/me/quick-access', {
        body: { setupId, arrowSetId },
        headers: ifMatch(versionA),
      });
      return mine.status === 200 ? null : `A could not set their own quick access (${mine.status})`;
    },
  },
  {
    route: 'GET /api/v1/me/export',
    async run({ call, userA, userB }) {
      const marker = `bow-of-${userA}`;
      await call(userA, 'POST', '/api/v1/bows', {
        body: { id: uuidv7(), bowType: 'compound', model: marker },
        headers: key(),
      });
      const mine = await (await call(userA, 'GET', '/api/v1/me/export')).text();
      if (!mine.includes(marker)) return "A's own export misses A's bow";
      // B asks for theirs: nothing of A's may be in it, in any collection.
      const theirs = await (await call(userB, 'GET', '/api/v1/me/export')).text();
      return theirs.includes(marker) || theirs.includes(userA)
        ? "B's export carries A's data"
        : null;
    },
  },
  {
    route: 'POST /api/v1/me/deletion-request',
    async run({ call, userA, userB }) {
      await call(userA, 'GET', '/api/v1/me');
      const answer = await call(userB, 'POST', '/api/v1/me/deletion-request', {
        headers: key(),
      });
      if (answer.status !== 200 && answer.status !== 409) {
        return `B could not ask for their own deletion (${answer.status})`;
      }
      const a = (await (await call(userA, 'GET', '/api/v1/me')).json()) as {
        deletionRequestedAt?: unknown;
      };
      return a.deletionRequestedAt === null ? null : "B's request marked A's account for deletion";
    },
  },
  {
    route: 'DELETE /api/v1/me/deletion-request',
    async run({ call, userA, userB }) {
      await call(userA, 'GET', '/api/v1/me');
      await call(userA, 'POST', '/api/v1/me/deletion-request', { headers: key() });
      // Whatever B has pending, it is B's own: A's request stays.
      await call(userB, 'DELETE', '/api/v1/me/deletion-request');
      const a = (await (await call(userA, 'GET', '/api/v1/me')).json()) as {
        deletionRequestedAt?: unknown;
      };
      return a.deletionRequestedAt === null || a.deletionRequestedAt === undefined
        ? "B's cancel withdrew A's request"
        : null;
    },
  },
];
