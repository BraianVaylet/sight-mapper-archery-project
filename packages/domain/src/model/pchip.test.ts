import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { createPchip } from './pchip.js';

const pts = (pairs: [number, number][]) =>
  pairs.map(([distanceM, valueMm]) => ({ distanceM, valueMm }));

describe('createPchip', () => {
  it('needs at least two points', () => {
    expect(() => createPchip(pts([[10, 5]]))).toThrow(DomainError);
  });

  it('is linear with two points', () => {
    const f = createPchip(
      pts([
        [10, 10],
        [20, 30],
      ]),
    );
    expect(f(15)).toBeCloseTo(20, 12);
    expect(f(12.5)).toBeCloseTo(15, 12);
  });

  it('matches a hand-computed reference set', () => {
    // h = 10 everywhere, delta = [0.5, 1.5, 1.0, 1.5]. Tangents by SIGHT-MATH §5:
    // t0 = 0 (three-point formula gives 0), t1 = 0.75, t2 = t3 = 1.2 (harmonic means), t4 = 1.75.
    const f = createPchip(
      pts([
        [20, 15],
        [30, 20],
        [40, 35],
        [50, 45],
        [60, 60],
      ]),
    );
    expect(f(25)).toBeCloseTo(16.5625, 10);
    expect(f(35)).toBeCloseTo(26.9375, 10);
    expect(f(45)).toBeCloseTo(40, 10);
    expect(f(55)).toBeCloseTo(51.8125, 10);
  });

  it('returns each measured value exactly', () => {
    const marks = pts([
      [20, 15],
      [30, 20],
      [40, 35],
      [50, 45],
      [60, 60],
    ]);
    const f = createPchip(marks);
    for (const m of marks) expect(f(m.distanceM)).toBe(m.valueMm);
  });

  it('does not overshoot at a local extremum', () => {
    const f = createPchip(
      pts([
        [10, 0],
        [20, 10],
        [30, 0],
      ]),
    );
    for (let d = 10; d <= 30; d += 0.5) expect(f(d)).toBeLessThanOrEqual(10 + 1e-9);
  });

  it('keeps a plateau flat', () => {
    const f = createPchip(
      pts([
        [10, 5],
        [20, 5],
        [30, 9],
      ]),
    );
    for (let d = 10; d <= 20; d += 1) expect(f(d)).toBeCloseTo(5, 12);
  });

  const monotoneSet = fc
    .tuple(
      fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 2, maxLength: 12 }),
      fc.array(fc.integer({ min: 0, max: 30 }), { minLength: 12, maxLength: 12 }),
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 0, max: 50 }),
    )
    .map(([gaps, rises, d0, m0]) => {
      let d = d0;
      let m = m0;
      return gaps.map((gap, i) => {
        d += gap;
        m += rises[i] ?? 0;
        return { distanceM: d, valueMm: m };
      });
    });

  it('is monotone and bounded between consecutive marks for monotone data', () => {
    fc.assert(
      fc.property(monotoneSet, (marks) => {
        const f = createPchip(marks);
        for (let i = 0; i < marks.length - 1; i++) {
          const a = marks[i];
          const b = marks[i + 1];
          if (a === undefined || b === undefined) continue;
          let prev = f(a.distanceM);
          for (let k = 1; k <= 20; k++) {
            const d = a.distanceM + ((b.distanceM - a.distanceM) * k) / 20;
            const v = f(d);
            expect(v).toBeGreaterThanOrEqual(a.valueMm - 1e-9);
            expect(v).toBeLessThanOrEqual(b.valueMm + 1e-9);
            expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
            prev = v;
          }
        }
      }),
    );
  });

  it('passes exactly through every mark for any data', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 300 }), { minLength: 2, maxLength: 10 }),
        fc.array(fc.double({ min: -100, max: 100, noNaN: true }), { minLength: 10, maxLength: 10 }),
        (ds, vs) => {
          const marks = [...ds]
            .sort((a, b) => a - b)
            .map((d, i) => ({ distanceM: d, valueMm: vs[i] ?? 0 }));
          const f = createPchip(marks);
          for (const m of marks) expect(f(m.distanceM)).toBe(m.valueMm);
        },
      ),
    );
  });
});
