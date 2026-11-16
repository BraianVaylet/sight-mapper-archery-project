import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { fitParabola } from './parabola.js';

const pts = (pairs: [number, number][]) =>
  pairs.map(([distanceM, valueMm]) => ({ distanceM, valueMm }));

describe('fitParabola', () => {
  it('needs three distinct distances', () => {
    expect(() =>
      fitParabola(
        pts([
          [10, 1],
          [20, 2],
        ]),
      ),
    ).toThrow(DomainError);
    expect(() =>
      fitParabola(
        pts([
          [10, 1],
          [10, 2],
          [20, 3],
        ]),
      ),
    ).toThrow(DomainError);
  });

  it('recovers an exact quadratic', () => {
    const q = (d: number) => 0.01 * d * d + 0.3 * d + 2;
    const marks = [10, 20, 30, 40, 50].map((d) => ({ distanceM: d, valueMm: q(d) }));
    const p = fitParabola(marks);
    for (const d of [0, 15, 33, 70, 100]) expect(p.evaluate(d)).toBeCloseTo(q(d), 9);
    expect(p.derivative(30)).toBeCloseTo(0.02 * 30 + 0.3, 9);
  });

  it('interpolates exactly with three points', () => {
    const marks = pts([
      [18, 3],
      [30, 11],
      [50, 40],
    ]);
    const p = fitParabola(marks);
    for (const m of marks) expect(p.evaluate(m.distanceM)).toBeCloseTo(m.valueMm, 9);
  });

  it('reports the vertex of a curved fit', () => {
    // q(d) = (d - 40)^2 / 10 + 5, vertex at 40 m
    const marks = [20, 30, 40, 50, 60].map((d) => ({
      distanceM: d,
      valueMm: (d - 40) ** 2 / 10 + 5,
    }));
    expect(fitParabola(marks).vertexM).toBeCloseTo(40, 6);
  });

  it('has no vertex for collinear data', () => {
    const marks = pts([
      [10, 5],
      [20, 10],
      [30, 15],
    ]);
    expect(fitParabola(marks).vertexM).toBeNull();
  });

  it('handles large distance offsets without losing precision', () => {
    const q = (d: number) => 0.002 * d * d + 0.1 * d;
    const marks = [200, 210, 220, 230].map((d) => ({ distanceM: d, valueMm: q(d) }));
    expect(fitParabola(marks).evaluate(240)).toBeCloseTo(q(240), 7);
  });

  it('reproduces any quadratic from distinct samples (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -0.05, max: 0.05, noNaN: true }),
        fc.double({ min: -2, max: 2, noNaN: true }),
        fc.double({ min: -20, max: 20, noNaN: true }),
        (a, b, c) => {
          const q = (d: number) => a * d * d + b * d + c;
          const marks = [10, 25, 40, 55, 70].map((d) => ({ distanceM: d, valueMm: q(d) }));
          const p = fitParabola(marks);
          expect(p.evaluate(85)).toBeCloseTo(q(85), 5);
        },
      ),
    );
  });
});
