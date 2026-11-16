import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toCanonical } from './quantity.js';
import { parseDecimal, parseImperial } from './parse.js';

describe('parseDecimal', () => {
  it.each([
    ['6.5', 6.5],
    ['6,5', 6.5],
    ['  12 ', 12],
    ['.5', 0.5],
    [',25', 0.25],
    ['5.', 5],
    ['-3,5', -3.5],
    ['+2', 2],
    ['007', 7],
  ])('parses %j as %d', (text, value) => {
    expect(parseDecimal(text)).toBe(value);
  });

  it.each(['', ' ', 'abc', '1.234,5', '1,234.5', '1..2', '1,,2', '6 1/4', '1e3', '--1', '.', ','])(
    'rejects %j',
    (text) => {
      expect(parseDecimal(text)).toBeNull();
    },
  );

  it('rejects a number too large to be finite', () => {
    expect(parseDecimal('9'.repeat(400))).toBeNull();
  });

  it('accepts comma and point interchangeably (property)', () => {
    fc.assert(
      fc.property(fc.nat({ max: 99_999 }), fc.nat({ max: 999 }), (whole, frac) => {
        const withPoint = `${whole}.${frac}`;
        const withComma = `${whole},${frac}`;
        expect(parseDecimal(withComma)).toBe(parseDecimal(withPoint));
        expect(parseDecimal(withPoint)).toBe(Number(withPoint));
      }),
    );
  });
});

describe('parseImperial', () => {
  it.each([
    ['6 1/4', 6.25],
    ['6-1/4', 6.25],
    ['6  -  1/4', 6.25],
    ['1/16', 0.0625],
    ['5/4', 1.25],
    ['6.25', 6.25],
    ['6,25', 6.25],
    ['-1 1/2', -1.5],
    ['-1/2', -0.5],
    ['7', 7],
  ])('parses %j as %d inches', (text, inches) => {
    expect(parseImperial(text)).toBe(inches);
  });

  it.each(['', '1/0', '6 1/0', '1/', '/4', '6 1/4/2', 'six', '6 1.5/4'])('rejects %j', (text) => {
    expect(parseImperial(text)).toBeNull();
  });

  it('"6 1/4" in imperial is 158.75 mm', () => {
    const inches = parseImperial('6 1/4');
    expect(inches).toBe(6.25);
    expect(toCanonical('length', inches ?? 0, 'in')).toBe(158.75);
  });

  it('every sixteenth typed as a fraction equals its decimal (property)', () => {
    fc.assert(
      fc.property(fc.nat({ max: 20 }), fc.integer({ min: 0, max: 15 }), (whole, sixteenths) => {
        const text = sixteenths === 0 ? `${whole}` : `${whole} ${sixteenths}/16`;
        expect(parseImperial(text)).toBe(whole + sixteenths / 16);
      }),
    );
  });
});
