import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import { createEnsureProfile } from './application/ensure-profile.js';
import { defaultPreferences, type Profile, type ProfileRepositories } from './domain/profile.js';

const NOW = Temporal.Instant.from('2026-11-01T12:00:00Z');
const clock = { now: () => NOW };

/** An in-memory store with the unique index on userId, and a hook to simulate a lost race. */
function memory(options: { loseRaceOnce?: boolean } = {}) {
  const rows = new Map<string, Profile>();
  let raced = false;
  const profiles: ProfileRepositories = {
    forUser: (userId) => ({
      findOwn: () => Promise.resolve(rows.get(userId) ?? null),
      insert(profile) {
        if (options.loseRaceOnce && !raced) {
          raced = true;
          rows.set(userId, { ...profile, id: 'winner' });
          return Promise.resolve(false);
        }
        if (rows.has(userId)) return Promise.resolve(false);
        rows.set(userId, profile);
        return Promise.resolve(true);
      },
    }),
  };
  return { rows, profiles };
}

describe('defaultPreferences', () => {
  it('gives Spanish speakers metres and English speakers yards, and follows the system theme', () => {
    expect(defaultPreferences('es')).toEqual({
      locale: 'es',
      unitSystem: 'metric',
      theme: 'system',
    });
    expect(defaultPreferences('en')).toEqual({
      locale: 'en',
      unitSystem: 'imperial',
      theme: 'system',
    });
  });
});

describe('ensureProfile', () => {
  it('creates the profile with defaults, version 1, and no quick access or deletion request', async () => {
    const { rows, profiles } = memory();
    const ensure = createEnsureProfile({ profiles, newId: () => 'p1', clock });
    const profile = await ensure('u1', 'es');
    expect(profile).toEqual({
      id: 'p1',
      userId: 'u1',
      locale: 'es',
      unitSystem: 'metric',
      theme: 'system',
      quickAccess: null,
      deletionRequestedAt: null,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(rows.get('u1')).toEqual(profile);
  });

  it('is idempotent: a second call returns the same profile and keeps its preferences', async () => {
    const { rows, profiles } = memory();
    let n = 0;
    const ensure = createEnsureProfile({ profiles, newId: () => `p${++n}`, clock });
    const first = await ensure('u1', 'es');
    const second = await ensure('u1', 'en'); // the saved language wins over a later header
    expect(second).toEqual(first);
    expect(rows.size).toBe(1);
    expect(n).toBe(1);
  });

  it('keeps archers apart', async () => {
    const { profiles } = memory();
    let n = 0;
    const ensure = createEnsureProfile({ profiles, newId: () => `p${++n}`, clock });
    const a = await ensure('u1', 'es');
    const b = await ensure('u2', 'en');
    expect([a.userId, b.userId]).toEqual(['u1', 'u2']);
    expect([a.unitSystem, b.unitSystem]).toEqual(['metric', 'imperial']);
  });

  it('returns the winner when a concurrent call created it first', async () => {
    const { profiles } = memory({ loseRaceOnce: true });
    const ensure = createEnsureProfile({ profiles, newId: () => 'mine', clock });
    expect((await ensure('u1', 'es')).id).toBe('winner');
  });

  it('fails loudly if a duplicate-key insert leaves nothing to read', async () => {
    const profiles: ProfileRepositories = {
      forUser: () => ({
        findOwn: () => Promise.resolve(null),
        insert: () => Promise.resolve(false),
      }),
    };
    await expect(
      createEnsureProfile({ profiles, newId: () => 'p', clock })('u1', 'es'),
    ).rejects.toThrow(/vanished/);
  });
});
