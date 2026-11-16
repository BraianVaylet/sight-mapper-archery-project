import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { fromCanonical, roundDistanceM, tidy, toCanonical } from './quantity.js';

describe('distance', () => {
  it('20 yd is exactly 18.288 m', () => {
    expect(toCanonical('distance', 20, 'yd')).toBe(18.288);
  });

  it('keeps metres as they are', () => {
    expect(toCanonical('distance', 70, 'm')).toBe(70);
  });

  it('rounds the canonical value to 1 mm', () => {
    expect(toCanonical('distance', 33.3333, 'yd')).toBe(30.48);
    expect(roundDistanceM(18.2884)).toBe(18.288);
    expect(roundDistanceM(18.2886)).toBe(18.289);
    expect(roundDistanceM(0.0004)).toBe(0);
    expect(Object.is(roundDistanceM(-0.0004), 0)).toBe(true);
  });

  it('converts metres to yards', () => {
    expect(fromCanonical('distance', 18.288, 'yd')).toBe(20);
    expect(fromCanonical('distance', 91.44, 'yd')).toBe(100);
  });

  it('round-trips every canonical millimetre through yards (test #6)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 300_000 }), (mm) => {
        const metres = mm / 1000;
        const yards = fromCanonical('distance', metres, 'yd');
        expect(toCanonical('distance', yards, 'yd')).toBe(metres);
      }),
    );
  });

  it('round-trips whole and half yards through metres (test #6)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 660 }), (halfYards) => {
        const yards = halfYards / 2;
        const metres = toCanonical('distance', yards, 'yd');
        expect(fromCanonical('distance', metres, 'yd')).toBeCloseTo(yards, 3);
      }),
    );
  });
});

describe('equipment quantities', () => {
  it.each([
    ['length', 'cm', 5, 50],
    ['length', 'in', 6.25, 158.75],
    ['length', 'mm', 12, 12],
    ['mass', 'g', 25, 25],
    ['mass', 'gr', 100, 6.479891],
    ['speed', 'fps', 300, 91.44],
    ['speed', 'mps', 90, 90],
    ['force', 'lb', 40, 177.92886461042],
    ['force', 'kg', 20, 196.133],
    ['force', 'N', 150, 150],
  ] as const)('%s: %s %d -> %d canonical', (quantity, unit, value, canonical) => {
    // @ts-expect-error unit/quantity pairing is checked by the table above
    expect(toCanonical(quantity, value, unit)).toBeCloseTo(canonical, 9);
  });

  it('round-trips every quantity and unit (test #6)', () => {
    const cases = [
      ['length', ['mm', 'cm', 'in']],
      ['mass', ['g', 'gr']],
      ['speed', ['mps', 'fps']],
      ['force', ['N', 'kg', 'lb']],
    ] as const;
    for (const [quantity, units] of cases) {
      for (const unit of units) {
        fc.assert(
          fc.property(fc.double({ min: 0.001, max: 5000, noNaN: true }), (value) => {
            // @ts-expect-error iterating the table: the pairing is valid by construction
            const back = fromCanonical(quantity, toCanonical(quantity, value, unit), unit);
            expect(back).toBeCloseTo(value, 6);
          }),
        );
      }
    }
  });
});

describe('guards', () => {
  it('rejects non-finite values as caller bugs', () => {
    expect(() => toCanonical('length', Number.NaN, 'mm')).toThrow(DomainError);
    expect(() => fromCanonical('mass', Number.POSITIVE_INFINITY, 'g')).toThrow(DomainError);
    expect(() => roundDistanceM(Number.NaN)).toThrow(DomainError);
  });

  it('rejects an unknown unit', () => {
    // @ts-expect-error not a distance unit
    expect(() => toCanonical('distance', 1, 'ft')).toThrow(DomainError);
  });

  it('tidy removes float noise', () => {
    expect(tidy(0.1 * 3)).toBe(0.3);
    expect(tidy(158.74999999999997)).toBe(158.75);
  });
});
