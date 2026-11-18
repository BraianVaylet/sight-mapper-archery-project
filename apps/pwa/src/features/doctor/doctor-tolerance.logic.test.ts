import { describe, expect, it } from 'vitest';
import {
  effectiveTolerance,
  exampleThresholds,
  formatInches,
  formatMm,
  lowTolerance,
  toleranceOptions,
} from './doctor-tolerance.logic.js';

describe('the Doctor tolerance screen (RF-CAL-09, RN-CAL-06)', () => {
  it('offers 1 to 10 mm in steps of half a millimetre: 19 choices', () => {
    const options = toleranceOptions();
    expect(options).toHaveLength(19);
    expect(options.slice(0, 3)).toEqual([1, 1.5, 2]);
    expect(options.at(-1)).toBe(10);
    expect(options).toContain(4);
  });

  it('uses the calibrated 4 mm until the archer picks one', () => {
    expect(effectiveTolerance(null)).toBe(4);
    expect(effectiveTolerance(undefined)).toBe(4);
    expect(effectiveTolerance(6.5)).toBe(6.5);
  });

  it('works the example out by hand: 4 mm inside, 4 × 2.5 = 10 mm at the ends', () => {
    expect(exampleThresholds(4)).toEqual({ inner: 4, ends: 10 });
    expect(exampleThresholds(1)).toEqual({ inner: 1, ends: 2.5 });
  });

  it('warns only at 1 mm, the one step where good marks get flagged', () => {
    expect([1, 1.5, 4].map(lowTolerance)).toEqual([true, false, false]);
  });

  it('writes millimetres and inches in the separator of the language', () => {
    expect(formatMm(2.5, ',')).toBe('2,5');
    expect(formatMm(10, '.')).toBe('10');
    expect(formatInches(4, '.')).toBe('0.157'); // 4 / 25.4 = 0.15748
    expect(formatInches(0.5, ',')).toBe('0,020');
  });
});
