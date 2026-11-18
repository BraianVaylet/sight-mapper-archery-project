import { describe, expect, it } from 'vitest';
import { ID, NOW } from '../test/fixtures.js';
import {
  DEFAULT_UNITS,
  profile,
  putQuickAccess,
  quickAccess,
  updatePreferences,
} from './account.js';

describe('updatePreferences', () => {
  it('takes any subset of the three preferences', () => {
    expect(updatePreferences.safeParse({ locale: 'en' }).success).toBe(true);
    expect(
      updatePreferences.safeParse({ theme: 'system', units: { marks: 'imperial' } }).success,
    ).toBe(true);
  });

  it('changes one section of the units without the others', () => {
    expect(updatePreferences.parse({ units: { bow: 'metric' } })).toEqual({
      units: { bow: 'metric' },
    });
    const empty = updatePreferences.safeParse({ units: {} });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe('validation.preferences.empty');
  });

  it('no longer takes the single unit system', () => {
    expect(updatePreferences.safeParse({ unitSystem: 'imperial' }).success).toBe(false);
  });

  it('needs at least one preference', () => {
    const result = updatePreferences.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.preferences.empty');
  });

  it('only accepts the dictionary values', () => {
    expect(updatePreferences.safeParse({ locale: 'fr' }).success).toBe(false);
    expect(updatePreferences.safeParse({ units: { marks: 'nautical' } }).success).toBe(false);
    expect(updatePreferences.safeParse({ units: { feet: 'imperial' } }).success).toBe(false);
    expect(updatePreferences.safeParse({ theme: 'sepia' }).success).toBe(false);
  });

  it('ignores unknown keys', () => {
    expect(updatePreferences.parse({ locale: 'es', userId: 'x' })).toEqual({ locale: 'es' });
  });
});

describe('doctorToleranceMm (RN-CAL-06)', () => {
  const parse = (value: unknown) =>
    updatePreferences.safeParse({ doctorToleranceMm: value }).success;

  it('takes 1 to 10 mm in steps of half a millimetre, and null for the default', () => {
    expect([1, 1.5, 4, 6.5, 10, null].map(parse)).toEqual([true, true, true, true, true, true]);
  });

  it('refuses anything outside the range or between steps', () => {
    expect([0.5, 10.5, 1.2, 4.25, -1, Number.NaN, '4'].map(parse)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('quick access', () => {
  it('is a setup and an arrow set', () => {
    expect(quickAccess.safeParse({ setupId: ID.a, arrowSetId: ID.b }).success).toBe(true);
    expect(quickAccess.safeParse({ setupId: ID.a }).success).toBe(false);
  });

  it('can be cleared with null', () => {
    expect(putQuickAccess.safeParse(null).success).toBe(true);
    expect(putQuickAccess.safeParse({ setupId: ID.a, arrowSetId: ID.b }).success).toBe(true);
    expect(putQuickAccess.safeParse(undefined).success).toBe(false);
  });
});

describe('profile', () => {
  const stored = {
    locale: 'es',
    units: DEFAULT_UNITS,
    doctorToleranceMm: null,
    theme: 'system',
    quickAccess: null,
    deletionRequestedAt: null,
    version: 3,
  };

  it('parses a profile', () => {
    expect(profile.safeParse(stored).success).toBe(true);
    expect(
      profile.safeParse({
        ...stored,
        quickAccess: { setupId: ID.a, arrowSetId: ID.b },
        deletionRequestedAt: NOW,
      }).success,
    ).toBe(true);
  });

  it('never exposes the user id', () => {
    expect(profile.parse({ ...stored, userId: 'secret' })).not.toHaveProperty('userId');
  });

  it('needs a version and every preference', () => {
    expect(profile.safeParse({ ...stored, version: 0 }).success).toBe(false);
    expect(profile.safeParse({ ...stored, theme: undefined }).success).toBe(false);
  });
});
