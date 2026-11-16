import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import {
  formatReading,
  hasPhysicalScale,
  mmToReading,
  readingToMm,
  roundReading,
  scaleBoundsMm,
  unitSizeFromLength,
  unitSizeMm,
  type ScaleUnit,
  type SightScale,
} from './scale.js';

const custom = (unitSize: number | null): SightScale => ({
  unit: 'custom',
  unitSizeMm: unitSize,
  min: 1,
  max: 9,
  resolution: 0.1,
  direction: 'down',
});

describe('unitSizeMm', () => {
  it('is fixed for mm, cm and in, whatever unitSizeMm says', () => {
    expect(unitSizeMm({ unit: 'mm', unitSizeMm: 7 })).toBe(1);
    expect(unitSizeMm({ unit: 'cm', unitSizeMm: null })).toBe(10);
    expect(unitSizeMm({ unit: 'in', unitSizeMm: null })).toBe(25.4);
  });

  it('uses what the archer loaded for click and custom', () => {
    expect(unitSizeMm({ unit: 'click', unitSizeMm: 0.5 })).toBe(0.5);
    expect(unitSizeMm({ unit: 'custom', unitSizeMm: 10 })).toBe(10);
  });

  it('falls back to a nominal 1 without a physical size', () => {
    expect(unitSizeMm({ unit: 'custom', unitSizeMm: null })).toBe(1);
  });

  it.each([0, -1, Number.NaN])('rejects a loaded size of %d', (size) => {
    expect(() => unitSizeMm({ unit: 'click', unitSizeMm: size })).toThrow(DomainError);
  });
});

describe('hasPhysicalScale', () => {
  it('is true for fixed units and loaded sizes only', () => {
    expect(hasPhysicalScale({ unit: 'mm', unitSizeMm: null })).toBe(true);
    expect(hasPhysicalScale({ unit: 'custom', unitSizeMm: 10 })).toBe(true);
    expect(hasPhysicalScale({ unit: 'custom', unitSizeMm: null })).toBe(false);
    expect(hasPhysicalScale({ unit: 'click', unitSizeMm: null })).toBe(false);
  });
});

describe('reading <-> mm', () => {
  it('converts a custom 1-9 scale with 10 mm per unit', () => {
    const scale = custom(10);
    expect(readingToMm(3.5, scale)).toBe(35);
    expect(mmToReading(35, scale)).toBe(3.5);
  });

  it('converts inches to millimetres', () => {
    expect(readingToMm(6.25, { unit: 'in', unitSizeMm: null })).toBe(158.75);
  });

  it('computes bounds in mm', () => {
    expect(scaleBoundsMm(custom(10))).toEqual({ minMm: 10, maxMm: 90 });
  });

  it('rejects non-finite input', () => {
    expect(() => readingToMm(Number.NaN, custom(10))).toThrow(DomainError);
    expect(() => mmToReading(Number.POSITIVE_INFINITY, custom(10))).toThrow(DomainError);
  });

  const units: [ScaleUnit, number | null][] = [
    ['mm', null],
    ['cm', null],
    ['in', null],
    ['click', 0.5],
    ['custom', 10],
  ];

  it.each(units)(
    '%s: any reading on the quantum grid survives the round trip (test #6)',
    (unit, size) => {
      const scale: SightScale = {
        unit,
        unitSizeMm: size,
        min: 0,
        max: 200,
        resolution: 0.05,
        direction: 'down',
      };
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4000 }), (steps) => {
          const reading = roundReading(steps * 0.05, scale);
          const mm = readingToMm(reading, scale);
          expect(roundReading(mmToReading(mm, scale), scale)).toBe(reading);
        }),
      );
    },
  );

  it.each(units)('%s: any position in mm comes back within float tolerance', (unit, size) => {
    const scale: SightScale = {
      unit,
      unitSizeMm: size,
      min: 0,
      max: 200,
      resolution: 0.05,
      direction: 'down',
    };
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), (mm) => {
        expect(readingToMm(mmToReading(mm, scale), scale)).toBeCloseTo(mm, 6);
      }),
    );
  });
});

describe('unitSizeFromLength', () => {
  it('derives the size from the measured length between min and max', () => {
    expect(unitSizeFromLength(80, 1, 9)).toBe(10);
    expect(unitSizeFromLength(47.5, 0, 9.5)).toBe(5);
  });

  it.each([
    [0, 1, 9],
    [-5, 1, 9],
    [80, 9, 9],
    [80, 9, 1],
    [Number.NaN, 1, 9],
    [80, Number.NaN, 9],
  ])('rejects length %d with range %d-%d', (length, min, max) => {
    expect(() => unitSizeFromLength(length, min, max)).toThrow(DomainError);
  });
});

describe('roundReading / formatReading', () => {
  it('rounds and formats by the sight resolution', () => {
    const scale = { resolution: 0.5 };
    expect(roundReading(3.26, scale)).toBe(3.5);
    expect(formatReading(3.26, scale)).toBe('3.5');
    expect(formatReading(3, scale, ',')).toBe('3,0');
  });
});
