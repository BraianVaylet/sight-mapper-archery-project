import type { SightScale } from '@sight-mapper/domain';
import { describe, expect, it } from 'vitest';
import { readWindage, showWindage } from './windage.logic.js';

/** A horizontal scale with 2 mm per unit, -5 to 5: what the archer reads is not millimetres. */
const WINDAGE: SightScale = {
  unit: 'custom',
  unitSizeMm: 2,
  min: -5,
  max: 5,
  resolution: 0.5,
  direction: 'down',
};

describe('the base windage of a setup (F1-42)', () => {
  it('reads what the archer typed on the horizontal scale, with the comma of the language', () => {
    expect(readWindage('2,5', WINDAGE, ',')).toEqual({ ok: true, windageMm: 5 });
  });

  it('takes an empty field as "no windage written down"', () => {
    expect(readWindage('  ', WINDAGE, ',')).toEqual({ ok: true, windageMm: null });
  });

  it('says a word is not a number', () => {
    expect(readWindage('x', WINDAGE, ',')).toEqual({
      ok: false,
      error: { messageKey: 'mark.errors.number', params: {} },
    });
  });

  it('refuses a windage off the horizontal scale, naming its ends as readings', () => {
    expect(readWindage('6', WINDAGE, ',')).toEqual({
      ok: false,
      error: { messageKey: 'sight.windageOutOfScale', params: { min: '-5,0', max: '5,0' } },
    });
  });

  it('shows a saved windage as a reading of the horizontal scale, and nothing when there is none', () => {
    expect(showWindage(5, WINDAGE, ',')).toBe('2,5');
    expect(showWindage(null, WINDAGE, ',')).toBe('');
  });
});
