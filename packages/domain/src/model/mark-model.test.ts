import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
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

describe('createMarkModel — staged calculation (SIGHT-MATH §4)', () => {
  it('0 marks: nothing can be answered (SM-CALC-422-001)', () => {
    expect(createMarkModel([]).markAt(30)).toEqual({
      ok: false,
      code: 'SM-CALC-422-001',
      params: { have: 0, need: 2 },
    });
  });

  it('1 mark: only the measured distance, exact', () => {
    const model = createMarkModel(pts([[30, 20]]));
    expect(model.markAt(30)).toEqual({
      ok: true,
      valueMm: 20,
      kind: 'measured',
      lowConfidence: false,
    });
    expect(model.markAt(31)).toEqual({
      ok: false,
      code: 'SM-CALC-422-001',
      params: { have: 1, need: 2 },
    });
  });

  it('2 marks: interpolates linearly inside the range', () => {
    const model = createMarkModel(
      pts([
        [20, 10],
        [40, 30],
      ]),
    );
    expect(model.markAt(30)).toEqual({
      ok: true,
      valueMm: 20,
      kind: 'interpolated',
      lowConfidence: false,
    });
  });

  it('2 marks: outside the range is SM-CALC-422-002', () => {
    const model = createMarkModel(
      pts([
        [20, 10],
        [40, 30],
      ]),
    );
    for (const d of [10, 41]) {
      expect(model.markAt(d)).toEqual({
        ok: false,
        code: 'SM-CALC-422-002',
        params: { have: 2, need: 3 },
      });
    }
  });

  it('3+ marks: extrapolates beyond the range and says so', () => {
    const model = createMarkModel(FIVE);
    const result = model.markAt(61);
    expect(result.ok && result.kind).toBe('extrapolated');
  });
});

describe('createMarkModel — the model honours the data', () => {
  it('returns each measured value exactly, kind measured', () => {
    const model = createMarkModel(FIVE);
    for (const m of FIVE) {
      expect(model.markAt(m.distanceM)).toEqual({
        ok: true,
        valueMm: m.valueMm,
        kind: 'measured',
        lowConfidence: false,
      });
    }
  });

  it('marks between measured distances as interpolated', () => {
    const result = createMarkModel(FIVE).markAt(35);
    expect(result).toMatchObject({ ok: true, kind: 'interpolated', lowConfidence: false });
  });

  it('is independent of input order and collapses repeated distances', () => {
    const shuffled = [FIVE[3], FIVE[0], FIVE[4], FIVE[2], FIVE[1], FIVE[2]].map((m) => ({
      distanceM: m?.distanceM ?? 0,
      valueMm: m?.valueMm ?? 0,
    }));
    const a = createMarkModel(shuffled).markAt(37);
    const b = createMarkModel(FIVE).markAt(37);
    expect(a).toEqual(b);
    expect(createMarkModel(shuffled).points).toEqual(FIVE);
  });

  it('rejects non-finite or non-positive query distances as caller bugs', () => {
    const model = createMarkModel(FIVE);
    expect(() => model.markAt(Number.NaN)).toThrow(DomainError);
    expect(() => model.markAt(0)).toThrow(DomainError);
    expect(() => model.markAt(-3)).toThrow(DomainError);
  });
});

describe('createMarkModel — anchored extrapolation (SIGHT-MATH §6)', () => {
  it('is continuous at d_max and d_min', () => {
    const model = createMarkModel(FIVE);
    const atMax = model.markAt(60);
    const justAbove = model.markAt(60 + 1e-9);
    const atMin = model.markAt(20);
    const justBelow = model.markAt(20 - 1e-9);
    if (!(atMax.ok && justAbove.ok && atMin.ok && justBelow.ok))
      throw new Error('unexpected failure');
    expect(Math.abs(justAbove.valueMm - atMax.valueMm)).toBeLessThan(1e-6);
    expect(Math.abs(justBelow.valueMm - atMin.valueMm)).toBeLessThan(1e-6);
    expect(model.markAt(60 + 1e-9)).toMatchObject({ kind: 'extrapolated' });
  });

  it('extends the curvature of the global fit (hand-computed)', () => {
    // exact quadratic q(d) = 0.01 d^2: the anchored extension equals q itself
    const q = (d: number) => 0.01 * d * d;
    const model = createMarkModel(
      [20, 30, 40, 50, 60].map((d) => ({ distanceM: d, valueMm: q(d) })),
    );
    const above = model.markAt(70);
    const below = model.markAt(15);
    expect(above.ok && above.valueMm).toBeCloseTo(q(70), 8);
    expect(below.ok && below.valueMm).toBeCloseTo(q(15), 8);
  });

  it('flags low confidence beyond 25% of the measured range, not before', () => {
    const model = createMarkModel(FIVE); // range 40 m -> 10 m threshold
    expect(model.markAt(65)).toMatchObject({ ok: true, lowConfidence: false });
    expect(model.markAt(70)).toMatchObject({ ok: true, lowConfidence: false });
    expect(model.markAt(70.5)).toMatchObject({ ok: true, lowConfidence: true });
    expect(model.markAt(8)).toMatchObject({ ok: true, lowConfidence: true });
  });

  it('extrapolates up to the vertex and refuses past it (SM-CALC-422-004)', () => {
    // q(d) = -0.01 (d - 80)^2 + 70: rising until 80 m. Data end at 60 m.
    const q = (d: number) => -0.01 * (d - 80) ** 2 + 70;
    const model = createMarkModel(
      [20, 30, 40, 50, 60].map((d) => ({ distanceM: d, valueMm: q(d) })),
    );
    expect(model.markAt(75)).toMatchObject({ ok: true, kind: 'extrapolated' });
    const past = model.markAt(90);
    expect(past).toMatchObject({ ok: false, code: 'SM-CALC-422-004' });
    if (!past.ok) expect(past.params['maxDistanceM']).toBeCloseTo(80, 6);
  });

  it('keeps extending when the vertex lies inside the measured range', () => {
    const model = createMarkModel(
      pts([
        [10, 10],
        [20, 18],
        [30, 20],
        [40, 18],
        [50, 10],
      ]),
    );
    expect(model.markAt(70)).toMatchObject({ ok: true, kind: 'extrapolated' });
  });

  it('refuses to extrapolate below d_min past the vertex too', () => {
    const q = (d: number) => 0.01 * (d - 10) ** 2 + 5; // vertex at 10 m, data from 20 m
    const model = createMarkModel(
      [20, 30, 40, 50, 60].map((d) => ({ distanceM: d, valueMm: q(d) })),
    );
    expect(model.markAt(12)).toMatchObject({ ok: true, kind: 'extrapolated' });
    const past = model.markAt(5);
    expect(past).toMatchObject({ ok: false, code: 'SM-CALC-422-004' });
    if (!past.ok) expect(past.params['maxDistanceM']).toBeCloseTo(10, 6);
  });

  it('extrapolates collinear data as a straight line', () => {
    const model = createMarkModel(
      pts([
        [20, 10],
        [30, 15],
        [40, 20],
      ]),
    );
    const result = model.markAt(100);
    expect(result.ok && result.valueMm).toBeCloseTo(50, 8);
  });
});

describe('createMarkModel — properties', () => {
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

  it('honours every measured mark and stays monotone inside the range', () => {
    fc.assert(
      fc.property(monotoneSet, (marks) => {
        const model = createMarkModel(marks);
        for (const m of marks) {
          expect(model.markAt(m.distanceM)).toMatchObject({
            ok: true,
            valueMm: m.valueMm,
            kind: 'measured',
          });
        }
        const first = marks[0];
        const last = marks[marks.length - 1];
        if (first === undefined || last === undefined) return;
        let prev = first.valueMm;
        for (let k = 0; k <= 60; k++) {
          const d = first.distanceM + ((last.distanceM - first.distanceM) * k) / 60;
          const r = model.markAt(d);
          if (!r.ok) throw new Error('unexpected failure inside range');
          expect(r.valueMm).toBeGreaterThanOrEqual(prev - 1e-9);
          prev = r.valueMm;
        }
      }),
    );
  });

  it('is continuous at d_max for 3+ marks (property)', () => {
    fc.assert(
      fc.property(
        monotoneSet.filter((s) => s.length >= 3),
        (marks) => {
          const model = createMarkModel(marks);
          const last = marks[marks.length - 1];
          if (last === undefined) return;
          const edge = model.markAt(last.distanceM);
          const beyond = model.markAt(last.distanceM + 1e-9);
          // a vertex right at the edge may legitimately refuse; otherwise it must be continuous
          if (beyond.ok && edge.ok)
            expect(Math.abs(beyond.valueMm - edge.valueMm)).toBeLessThan(1e-6);
        },
      ),
    );
  });
});
