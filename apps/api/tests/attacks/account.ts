import type { Attack } from '../helpers/isolation.js';

const ifMatch = (version: number) => ({ 'if-match': `"${version}"` });
const theme = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { theme?: unknown }).theme;

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
];
