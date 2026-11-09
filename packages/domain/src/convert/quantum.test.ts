import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { decimalsForQuantum, formatDecimal, roundToQuantum } from './quantum.js';

describe('decimalsForQuantum', () => {
  it.each([
    [1, 0],
    [10, 0],
    [0.5, 1],
    [0.1, 1],
    [0.25, 2],
    [0.05, 2],
    [0.125, 3],
    [0.000001, 6],
  ])('quantum %d shows %d decimals', (quantum, decimals) => {
    expect(decimalsForQuantum(quantum)).toBe(decimals);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e-7])('rejects %d', (quantum) => {
    expect(() => decimalsForQuantum(quantum)).toThrow(DomainError);
  });
});

describe('roundToQuantum', () => {
  it('rounds to the nearest multiple', () => {
    expect(roundToQuantum(3.26, 0.5)).toBe(3.5);
    expect(roundToQuantum(3.24, 0.5)).toBe(3);
    expect(roundToQuantum(7.3, 1)).toBe(7);
    expect(roundToQuantum(2.37, 0.25)).toBe(2.25);
  });

  it('is exact where float arithmetic drifts', () => {
    // 3 * 0.1 = 0.30000000000000004 in floats; the quantum grid must give exactly 0.3
    expect(roundToQuantum(0.30000000000000004, 0.1)).toBe(0.3);
    expect(roundToQuantum(0.7, 0.1)).toBe(0.7);
  });

  it('rounds half away from zero, symmetric around zero', () => {
    expect(roundToQuantum(0.25, 0.5)).toBe(0.5);
    expect(roundToQuantum(-0.25, 0.5)).toBe(-0.5);
    expect(roundToQuantum(-0.2, 0.5)).toBe(0);
    expect(Object.is(roundToQuantum(-0.2, 0.5), 0)).toBe(true);
  });

  it('keeps any multiple of the quantum unchanged (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2000, max: 2000 }),
        fc.constantFrom(1, 0.5, 0.25, 0.1, 0.05),
        (n, q) => {
          const value = roundToQuantum(n * q, q);
          expect(roundToQuantum(value, q)).toBe(value);
          expect(Math.abs(value - n * q)).toBeLessThan(1e-9);
        },
      ),
    );
  });

  it('rejects non-finite values', () => {
    expect(() => roundToQuantum(Number.NaN, 1)).toThrow(DomainError);
  });
});

describe('formatDecimal', () => {
  it('shows the decimals the quantum implies', () => {
    expect(formatDecimal(3, 0.5)).toBe('3.0');
    expect(formatDecimal(3.5, 0.5)).toBe('3.5');
    expect(formatDecimal(2.3, 0.25)).toBe('2.25');
    expect(formatDecimal(7.4, 1)).toBe('7');
    expect(formatDecimal(0.05, 0.05)).toBe('0.05');
  });

  it('uses the locale separator', () => {
    expect(formatDecimal(3.5, 0.5, ',')).toBe('3,5');
    expect(formatDecimal(-12.25, 0.25, ',')).toBe('-12,25');
  });

  it('never prints a negative zero', () => {
    expect(formatDecimal(-0.01, 0.5)).toBe('0.0');
    expect(formatDecimal(-0.4, 1)).toBe('0');
  });

  it('pads fractional digits', () => {
    expect(formatDecimal(10.05, 0.05)).toBe('10.05');
    expect(formatDecimal(10.5, 0.05)).toBe('10.50');
  });
});
