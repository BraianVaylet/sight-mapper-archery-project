import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { gridDistances, queryDistance, calculateGrid } from './grid.js';
import { createMarkModel } from './mark-model.js';

const pts = (pairs: [number, number][]) =>
  pairs.map(([distanceM, valueMm]) => ({ distanceM, valueMm }));
const FIVE = pts([
  [20, 15],
  [30, 20],
  [40, 35],
  [50, 45],
  [60, 60],
]);

describe('gridDistances', () => {
  it('is recomputed from the origin, never accumulated', () => {
    const grid = gridDistances(0, 1, 0.1);
    expect(grid).toHaveLength(11);
    expect(grid[10]).toBe(1); // 0 + 10 * 0.1 would drift if accumulated
    expect(grid[3]).toBe(3 * 0.1);
  });

  it('includes both ends when the step divides the range', () => {
    expect(gridDistances(18, 90, 18)).toEqual([18, 36, 54, 72, 90]);
  });

  it('stops at the last full step', () => {
    expect(gridDistances(20, 52, 10)).toEqual([20, 30, 40, 50]);
  });

  it('survives float noise in the division', () => {
    expect(gridDistances(0, 0.3, 0.1)).toHaveLength(4);
  });

  it('yields a single row when from equals to', () => {
    expect(gridDistances(30, 30, 5)).toEqual([30]);
  });

  it.each([
    ['zero step', 10, 20, 0],
    ['negative step', 10, 20, -5],
    ['reversed range', 20, 10, 5],
    ['non-finite from', Number.NaN, 20, 5],
    ['non-finite step', 10, 20, Number.POSITIVE_INFINITY],
    ['too many rows', 0, 1_000_000, 1],
  ])('throws DomainError for %s', (_label, from, to, step) => {
    expect(() => gridDistances(from, to, step)).toThrow(DomainError);
  });

  it('has k = floor((to-from)/step)+1 rows spaced by step (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 200 }),
        fc.constantFrom(1, 2, 5, 10),
        (from, span, step) => {
          const grid = gridDistances(from, from + span, step);
          expect(grid).toHaveLength(Math.floor(span / step) + 1);
          grid.forEach((d, k) => expect(d).toBe(from + k * step));
        },
      ),
    );
  });
});

describe('queryDistance', () => {
  const model = createMarkModel(FIVE);

  it('returns a measured row exactly', () => {
    expect(queryDistance(model, 40)).toEqual({
      ok: true,
      distanceM: 40,
      scaleValueMm: 35,
      kind: 'measured',
      lowConfidence: false,
      outOfScale: false,
    });
  });

  it('snaps to a measured mark within 1 mm of distance', () => {
    const row = queryDistance(model, 40.0004);
    expect(row).toMatchObject({ ok: true, scaleValueMm: 35, kind: 'measured' });
  });

  it('does not snap beyond 1 mm', () => {
    expect(queryDistance(model, 40.002)).toMatchObject({ ok: true, kind: 'interpolated' });
  });

  it('flags outOfScale without clipping the value (RN-CAL-04)', () => {
    const row = queryDistance(model, 55, { minMm: 0, maxMm: 50 });
    expect(row).toMatchObject({ ok: true, outOfScale: true });
    if (row.ok) expect(row.scaleValueMm).toBeGreaterThan(50);
    expect(queryDistance(model, 55, { minMm: 0, maxMm: 100 })).toMatchObject({ outOfScale: false });
    expect(queryDistance(model, 20, { minMm: 16, maxMm: 100 })).toMatchObject({ outOfScale: true });
  });

  it('propagates model failures with the distance', () => {
    const two = createMarkModel(
      pts([
        [20, 10],
        [40, 30],
      ]),
    );
    expect(queryDistance(two, 70)).toEqual({
      ok: false,
      distanceM: 70,
      code: 'SM-CALC-422-002',
      params: { have: 2, need: 3 },
    });
  });
});

describe('calculateGrid', () => {
  const model = createMarkModel(FIVE);

  it('evaluates every row in metres, converting from the archer unit', () => {
    const rows = calculateGrid(model, { from: 20, to: 60, step: 10, unitToMeters: 1 });
    expect(rows.map((r) => r.distanceM)).toEqual([20, 30, 40, 50, 60]);
    expect(rows.every((r) => r.ok && r.kind === 'measured')).toBe(true);
  });

  it('converts yards to metres before evaluating', () => {
    const rows = calculateGrid(model, { from: 30, to: 40, step: 5, unitToMeters: 0.9144 });
    expect(rows).toHaveLength(3);
    expect(rows[0]?.distanceM).toBeCloseTo(27.432, 10); // 30 yd
    expect(rows[1]?.distanceM).toBeCloseTo(32.004, 10); // 35 yd
    expect(rows[2]?.distanceM).toBeCloseTo(36.576, 10); // 40 yd
  });

  it('mixes ok and failed rows for a two-mark model', () => {
    const two = createMarkModel(
      pts([
        [20, 10],
        [40, 30],
      ]),
    );
    const rows = calculateGrid(two, { from: 10, to: 50, step: 10, unitToMeters: 1 });
    expect(rows.map((r) => r.ok)).toEqual([false, true, true, true, false]);
  });
});
