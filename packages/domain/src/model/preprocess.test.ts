import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { preprocess } from './preprocess.js';

describe('preprocess', () => {
  it('sorts marks by distance without mutating the input', () => {
    const input = [
      { distanceM: 30, valueMm: 20 },
      { distanceM: 10, valueMm: 5 },
      { distanceM: 20, valueMm: 12 },
    ];
    const copy = input.map((m) => ({ ...m }));
    expect(preprocess(input).map((m) => m.distanceM)).toEqual([10, 20, 30]);
    expect(input).toEqual(copy);
  });

  it('collapses repeated distances by averaging the position', () => {
    const out = preprocess([
      { distanceM: 20, valueMm: 10 },
      { distanceM: 20, valueMm: 14 },
      { distanceM: 30, valueMm: 20 },
    ]);
    expect(out).toEqual([
      { distanceM: 20, valueMm: 12 },
      { distanceM: 30, valueMm: 20 },
    ]);
  });

  it('returns an empty list for no marks', () => {
    expect(preprocess([])).toEqual([]);
  });

  it.each([
    ['NaN distance', { distanceM: Number.NaN, valueMm: 1 }],
    ['infinite distance', { distanceM: Number.POSITIVE_INFINITY, valueMm: 1 }],
    ['zero distance', { distanceM: 0, valueMm: 1 }],
    ['negative distance', { distanceM: -5, valueMm: 1 }],
    ['NaN value', { distanceM: 10, valueMm: Number.NaN }],
    ['infinite value', { distanceM: 10, valueMm: Number.NEGATIVE_INFINITY }],
  ])('throws DomainError for %s', (_label, mark) => {
    expect(() => preprocess([mark])).toThrow(DomainError);
  });
});
