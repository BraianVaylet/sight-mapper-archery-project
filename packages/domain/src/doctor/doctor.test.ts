import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import fixtures from '../../test/fixtures/real-sets.json' with { type: 'json' };
import {
  DOCTOR_ENDPOINT_FACTOR,
  DOCTOR_MIN_ABS_MM,
  DOCTOR_TOLERANCE_MAX_MM,
  DOCTOR_TOLERANCE_MIN_MM,
  DOCTOR_TOLERANCE_STEP_MM,
} from '../constants.js';
import { readingToMm } from '../convert/scale.js';
import { DomainError } from '../errors.js';
import { diagnose, type DoctorMark, type DoctorOptions } from './doctor.js';

// The author's sight: 0-10 cm, 1 mm step (so the quantum is 1 mm), readings grow with distance.
const scale = { unit: 'cm', unitSizeMm: null } as const;
const options: DoctorOptions = { direction: 'down', quantumMm: 1 };

const marksOf = (set: (typeof fixtures.sets)[number]): DoctorMark[] =>
  set.marks.map((m) => ({
    id: `${m.distanceM}m`,
    distanceM: m.distanceM,
    valueMm: readingToMm(m.reading, scale),
  }));

const hunter = marksOf(fixtures.sets[0] as (typeof fixtures.sets)[number]);
const pierce = marksOf(fixtures.sets[1] as (typeof fixtures.sets)[number]);

const mark = (distanceM: number, valueMm: number): DoctorMark => ({
  id: `${distanceM}m`,
  distanceM,
  valueMm,
});
const marks = (pairs: [number, number][]) => pairs.map(([d, v]) => mark(d, v));

/** `set` with `delta` mm added to the mark at `index`. */
const inject = (set: readonly DoctorMark[], index: number, delta: number): DoctorMark[] =>
  set.map((m, i) => (i === index ? { ...m, valueMm: m.valueMm + delta } : m));

describe('the author’s real sets (F0-21)', () => {
  it('reads the fixtures in millimetres', () => {
    expect(hunter.map((m) => m.valueMm)).toEqual([3, 8, 16, 26, 36]);
    expect(pierce.map((m) => m.valueMm)).toEqual([4, 10, 18, 25, 35]);
  });

  it('a set the author marked good is ok, with every residual under its threshold', () => {
    const report = diagnose(hunter, options);
    expect(report.status).toBe('ok');
    expect(report.level).toBe('full');
    expect(report.suspect).toBeUndefined();
    expect(report.secondary).toEqual([]);
    expect(report.monotonicity).toEqual([]);
    for (const r of report.residuals) expect(Math.abs(r.residualMm)).toBeLessThan(r.thresholdMm);
  });

  it('the author doubts the 40 m mark of the doubtful set: the ranking points at it, but it is under the tolerance', () => {
    const doubtful = fixtures.sets[1] as { suspectMark: number };
    const report = diagnose(pierce, options);
    expect(report.status).toBe('ok');
    expect(report.monotonicity).toEqual([]);

    // Among the interior marks, the one the author doubts deviates the most from the trend...
    const interior = report.residuals.slice(1, -1);
    const largest = interior.reduce((a, b) =>
      Math.abs(b.residualMm) > Math.abs(a.residualMm) ? b : a,
    );
    expect(largest.markId).toBe(`${doubtful.suspectMark}m`);

    // ...but only by about a millimetre. A good set has interior residuals of the same size, so a
    // tolerance low enough to flag this mark would flag the good one too.
    const goodInterior = diagnose(hunter, options).residuals.slice(1, -1);
    const goodWorst = Math.max(...goodInterior.map((r) => Math.abs(r.residualMm)));
    expect(Math.abs(largest.residualMm)).toBeLessThan(DOCTOR_MIN_ABS_MM);
    expect(Math.abs(largest.residualMm) - goodWorst).toBeLessThan(0.5);
  });

  it('is independent of the order the marks arrive in', () => {
    expect(diagnose([...hunter].reverse(), options)).toEqual(diagnose(hunter, options));
  });
});

describe('an injected error of one scale unit (10 mm) in an interior mark', () => {
  const interior = [1, 2, 3];

  it.each(interior.flatMap((i) => [10, -10].map((delta) => [i, delta] as const)))(
    'mark %i with %i mm: it is the suspect and the worst',
    (index, delta) => {
      const report = diagnose(inject(hunter, index, delta), options);
      expect(report.suspect?.markId).toBe(hunter[index]?.id);
      expect(report.suspect?.suggestion).toBe('reshoot');
      expect(Math.abs(report.suspect?.residualMm ?? 0)).toBeGreaterThan(DOCTOR_MIN_ABS_MM);
      expect(report.status === 'suspect' || report.status === 'inconsistent').toBe(true);
    },
  );

  it('half a unit (5 mm) is still found in the middle of the range', () => {
    for (const delta of [5, -5]) {
      expect(diagnose(inject(hunter, 2, delta), options).suspect?.markId).toBe('40m');
    }
  });

  it('is not found when it is as small as normal measuring noise', () => {
    for (const delta of [1, -1, 2, -2]) {
      expect(diagnose(inject(hunter, 2, delta), options).status).toBe('ok');
    }
  });

  it('lists the other marks over their threshold as secondary, never the suspect itself', () => {
    const report = diagnose(inject(hunter, 2, 10), options);
    expect(report.secondary).not.toContain(report.suspect?.markId);
  });
});

describe('monotonicity (from 2 marks)', () => {
  it('flags a farther mark that reads lower, naming both marks, with direction down', () => {
    const report = diagnose(
      marks([
        [20, 10],
        [30, 25],
        [40, 20],
        [50, 40],
      ]),
      options,
    );
    expect(report.status).toBe('inconsistent');
    expect(report.monotonicity).toEqual([{ markIds: ['30m', '40m'] }]);
  });

  it('expects readings to fall with distance when the numbers grow upward', () => {
    const up: DoctorOptions = { direction: 'up', quantumMm: 1 };
    expect(
      diagnose(
        marks([
          [20, 40],
          [30, 30],
          [40, 20],
        ]),
        up,
      ).status,
    ).toBe('ok');
    const report = diagnose(
      marks([
        [20, 40],
        [30, 30],
        [40, 35],
      ]),
      up,
    );
    expect(report.monotonicity).toEqual([{ markIds: ['30m', '40m'] }]);
  });

  it('treats equal readings at different distances as a break', () => {
    const report = diagnose(
      marks([
        [20, 10],
        [30, 10],
      ]),
      options,
    );
    expect(report.status).toBe('inconsistent');
    expect(report.monotonicity).toHaveLength(1);
  });

  it('reports every broken pair', () => {
    const report = diagnose(
      marks([
        [20, 30],
        [30, 20],
        [40, 10],
        [50, 40],
      ]),
      options,
    );
    expect(report.monotonicity.map((p) => p.markIds.join('>'))).toEqual(['20m>30m', '30m>40m']);
  });

  it('prevails over a statistical suspicion, which it still reports', () => {
    const report = diagnose(inject(hunter, 2, -10), options);
    expect(report.status).toBe('inconsistent');
    expect(report.monotonicity.length).toBeGreaterThan(0);
    expect(report.suspect?.markId).toBe('40m');
  });

  it('a monotone set with a suspect is just suspect', () => {
    const report = diagnose(inject(hunter, 2, 5), options);
    expect(report.monotonicity).toEqual([]);
    expect(report.status).toBe('suspect');
  });
});

describe('how much analysis each number of marks allows (SIGHT-MATH §4)', () => {
  it('0 and 1 marks: insufficient', () => {
    for (const set of [[], marks([[30, 10]])]) {
      expect(diagnose(set, options)).toEqual({
        status: 'insufficient',
        level: 'none',
        residuals: [],
        secondary: [],
        monotonicity: [],
      });
    }
  });

  it('2 to 4 marks: only monotonicity, no residuals', () => {
    for (const n of [2, 3, 4]) {
      const report = diagnose(hunter.slice(0, n), options);
      expect(report.level).toBe('monotonicity');
      expect(report.residuals).toEqual([]);
      expect(report.status).toBe('ok');
    }
  });

  it('2 to 4 marks still catch a broken direction', () => {
    expect(
      diagnose(
        marks([
          [20, 30],
          [30, 10],
          [40, 50],
        ]),
        options,
      ).status,
    ).toBe('inconsistent');
  });

  it('5 marks: the full analysis, one residual per mark in distance order', () => {
    const report = diagnose(hunter, options);
    expect(report.level).toBe('full');
    expect(report.residuals.map((r) => r.markId)).toEqual(['20m', '30m', '40m', '50m', '60m']);
  });
});

describe('thresholds', () => {
  it('give the endpoints more room than the interior marks', () => {
    const report = diagnose(hunter, options);
    const [first, second, , , last] = report.residuals;
    expect(second?.thresholdMm).toBe(DOCTOR_MIN_ABS_MM);
    expect(first?.thresholdMm).toBe(DOCTOR_MIN_ABS_MM * DOCTOR_ENDPOINT_FACTOR);
    expect(last?.thresholdMm).toBe(first?.thresholdMm);
  });

  it('never fall under one quantum: a coarse sight is not blamed for its own step', () => {
    const coarse = diagnose(hunter, { direction: 'down', quantumMm: 10 });
    for (const r of coarse.residuals.slice(1, -1)) expect(r.thresholdMm).toBe(10);
  });

  it('do not depend on the other marks: a noisy set does not raise them', () => {
    const noisy = diagnose(inject(inject(hunter, 1, 3), 3, -3), options);
    expect(noisy.residuals[2]?.thresholdMm).toBe(DOCTOR_MIN_ABS_MM);
  });

  it('flag a mark whose residual is exactly its threshold, not one just under it', () => {
    const set = inject(hunter, 2, 10);
    const residual = Math.abs(diagnose(set, options).suspect?.residualMm ?? 0);
    // a quantum equal to the residual makes the interior threshold equal to it
    expect(diagnose(set, { direction: 'down', quantumMm: residual }).suspect?.markId).toBe('40m');
    expect(
      diagnose(set, { direction: 'down', quantumMm: residual + 1e-6 }).suspect,
    ).toBeUndefined();
  });
});

describe('the archer’s own tolerance (RN-CAL-06, ADR-013)', () => {
  it('without one, the calibrated 4 mm: the same report as passing it', () => {
    expect(diagnose(hunter, options)).toEqual(
      diagnose(hunter, { ...options, toleranceMm: DOCTOR_MIN_ABS_MM }),
    );
    expect(diagnose(pierce, { ...options, toleranceMm: undefined })).toEqual(
      diagnose(pierce, options),
    );
  });

  it('sets the base of every threshold: 6 mm inside, 6 × 2.5 = 15 mm at the endpoints', () => {
    const { residuals } = diagnose(hunter, { ...options, toleranceMm: 6 });
    expect(residuals.map((r) => r.thresholdMm)).toEqual([15, 6, 6, 6, 15]);
  });

  it('still never goes under one quantum: a 2 mm step with a 1 mm tolerance gives 2 mm', () => {
    const { residuals } = diagnose(hunter, { direction: 'down', quantumMm: 2, toleranceMm: 1 });
    expect(residuals.map((r) => r.thresholdMm)).toEqual([5, 2, 2, 2, 5]);
  });

  // Leave-one-out residuals worked out by hand (exact least squares): Hunter 2.5, -0.864, -0.167,
  // 1.045, -2.75; Pierce 0, -0.318, 1.167, -0.955, 1.75.
  it('at 1 mm it flags the doubtful 40 m, and the good set too (SIGHT-MATH §8.3)', () => {
    const doubtful = fixtures.sets[1] as { suspectMark: number };
    const strict = { ...options, toleranceMm: 1 };
    expect(diagnose(pierce, strict).suspect?.markId).toBe(`${doubtful.suspectMark}m`); // 1.167 / 1
    // The good set's worst is its 60 m endpoint: 2.75 / 2.5 = 1.1.
    expect(diagnose(hunter, strict).suspect?.markId).toBe('60m');
  });

  it('at the next step, 1.5 mm, both real sets are ok again', () => {
    for (const set of [hunter, pierce]) {
      expect(diagnose(set, { ...options, toleranceMm: 1.5 }).status).toBe('ok');
    }
  });

  it('has a default the archer can pick: inside the range and on a step', () => {
    expect(DOCTOR_MIN_ABS_MM).toBeGreaterThanOrEqual(DOCTOR_TOLERANCE_MIN_MM);
    expect(DOCTOR_MIN_ABS_MM).toBeLessThanOrEqual(DOCTOR_TOLERANCE_MAX_MM);
    expect(Number.isInteger(DOCTOR_MIN_ABS_MM / DOCTOR_TOLERANCE_STEP_MM)).toBe(true);
  });

  /** Any 2 to 8 marks at distinct distances, any values, any quantum: no shape assumed. */
  const anySet = fc
    .record({
      distances: fc.uniqueArray(fc.integer({ min: 5, max: 120 }), { minLength: 2, maxLength: 8 }),
      values: fc.array(fc.double({ min: -80, max: 80, noNaN: true }), {
        minLength: 8,
        maxLength: 8,
      }),
      quantumMm: fc.double({ min: 0.5, max: 5, noNaN: true }),
      direction: fc.constantFrom<'down' | 'up'>('down', 'up'),
    })
    .map(({ distances, values, quantumMm, direction }) => ({
      set: distances.map((d, i) => mark(d, values[i] ?? 0)),
      opts: { direction, quantumMm },
    }));
  const steps = fc.integer({ min: 2, max: 20 }).map((n) => n / 2); // 1..10 mm in 0.5 steps

  it('without one, always the same report as the calibrated 4 mm, for any set', () => {
    fc.assert(
      fc.property(anySet, ({ set, opts }) => {
        expect(diagnose(set, opts)).toEqual(
          diagnose(set, { ...opts, toleranceMm: DOCTOR_MIN_ABS_MM }),
        );
      }),
    );
  });

  it('under one quantum it changes nothing: the quantum is the floor', () => {
    fc.assert(
      fc.property(anySet, steps, steps, ({ set, opts }, a, b) => {
        const quantumMm = Math.max(a, b);
        expect(diagnose(set, { ...opts, quantumMm, toleranceMm: Math.min(a, b) })).toEqual(
          diagnose(set, { ...opts, quantumMm, toleranceMm: quantumMm }),
        );
      }),
    );
  });

  it('a larger tolerance never flags more, and what is ok stays ok', () => {
    const flagged = (report: ReturnType<typeof diagnose>) =>
      new Set([...(report.suspect ? [report.suspect.markId] : []), ...report.secondary]);
    fc.assert(
      fc.property(anySet, steps, steps, ({ set, opts }, x, y) => {
        const strict = diagnose(set, { ...opts, toleranceMm: Math.min(x, y) });
        const loose = diagnose(set, { ...opts, toleranceMm: Math.max(x, y) });
        const strictIds = flagged(strict);
        for (const id of flagged(loose)) expect(strictIds.has(id)).toBe(true);
        if (strict.status === 'ok') expect(loose.status).toBe('ok');
      }),
    );
  });

  it('never changes the monotonicity check: a broken direction is broken at any tolerance', () => {
    const broken = marks([
      [20, 10],
      [30, 20],
      [40, 15],
      [50, 40],
      [60, 55],
    ]);
    for (const toleranceMm of [1, 4, 10]) {
      expect(diagnose(broken, { ...options, toleranceMm }).monotonicity).toEqual([
        { markIds: ['30m', '40m'] }, // 20 → 15 goes back up the scale
      ]);
    }
  });
});

describe('inputs', () => {
  it('rejects a tolerance outside 1-10 mm or off the 0.5 steps, as a DomainError', () => {
    for (const toleranceMm of [
      0,
      -0,
      -1,
      0.5,
      10.5,
      1.25,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() => diagnose(hunter, { ...options, toleranceMm })).toThrow(DomainError);
    }
  });

  it('rejects what is a bug of the caller, as a DomainError', () => {
    const bad: [string, DoctorMark[], DoctorOptions][] = [
      ['duplicate distance', [mark(20, 1), { ...mark(20, 2), id: 'other' }], options],
      ['duplicate id', [mark(20, 1), { ...mark(30, 2), id: '20m' }], options],
      ['non-finite value', [mark(20, Number.NaN)], options],
      ['non-finite distance', [mark(Number.POSITIVE_INFINITY, 1)], options],
      ['zero distance', [mark(0, 1)], options],
      ['negative distance', [mark(-5, 1)], options],
      ['zero quantum', [mark(20, 1)], { direction: 'down', quantumMm: 0 }],
      ['NaN quantum', [mark(20, 1)], { direction: 'down', quantumMm: Number.NaN }],
    ];
    for (const [label, input, opts] of bad) {
      expect(() => diagnose(input, opts), label).toThrow(DomainError);
    }
  });

  it('does not change the marks it is given', () => {
    const input = [...hunter].reverse();
    const copy = input.map((m) => ({ ...m }));
    diagnose(input, options);
    expect(input).toEqual(copy);
  });
});

describe('properties', () => {
  /** A rising parabola sampled every 10 m from 20 m: data a sight could really produce. */
  const clean = (n: number, a: number, b: number, c: number): DoctorMark[] =>
    Array.from({ length: n }, (_, i) => {
      const d = 20 + 10 * i;
      return mark(d, a * d * d + b * d + c);
    });

  const curve = fc.record({
    n: fc.integer({ min: 5, max: 9 }),
    a: fc.double({ min: 0.001, max: 0.01, noNaN: true }),
    b: fc.double({ min: 0.05, max: 0.5, noNaN: true }),
    c: fc.double({ min: -20, max: 10, noNaN: true }),
  });

  it('never accuses data that lies exactly on a rising parabola', () => {
    fc.assert(
      fc.property(curve, ({ n, a, b, c }) => {
        const report = diagnose(clean(n, a, b, c), options);
        expect(report.status).toBe('ok');
        expect(report.suspect).toBeUndefined();
      }),
    );
  });

  // Real steps are 5-10 mm per 10 m. With steps smaller than the noise the order can flip, and the
  // monotonicity check is right to say so, so the generator keeps the slope realistic (>= 8 mm).
  const steep = curve.map((c) => ({ ...c, b: 0.8 + (c.b - 0.05) * 1.5 }));

  it('never accuses a clean curve with ±1 mm of measuring noise', () => {
    fc.assert(
      fc.property(
        steep,
        fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 9, maxLength: 9 }),
        ({ n, a, b, c }, noise) => {
          const noisy = clean(n, a, b, c).map((m, i) => ({
            ...m,
            valueMm: m.valueMm + (noise[i] ?? 0),
          }));
          const report = diagnose(noisy, options);
          expect(report.suspect).toBeUndefined();
          expect(report.monotonicity).toEqual([]);
        },
      ),
    );
  });

  it('keeps its report coherent for any input', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 300 }), { minLength: 0, maxLength: 12 }),
        fc.array(fc.double({ min: -200, max: 200, noNaN: true }), { minLength: 12, maxLength: 12 }),
        fc.constantFrom<'down' | 'up'>('down', 'up'),
        (distances, values, direction) => {
          const input = distances.map((d, i) => mark(d, values[i] ?? 0));
          const report = diagnose(input, { direction, quantumMm: 1 });

          expect(report.residuals).toHaveLength(input.length >= 5 ? input.length : 0);
          expect(report.level).toBe(
            input.length >= 5 ? 'full' : input.length >= 2 ? 'monotonicity' : 'none',
          );
          if (report.suspect !== undefined) {
            expect(report.secondary).not.toContain(report.suspect.markId);
            const own = report.residuals.find((r) => r.markId === report.suspect?.markId);
            expect(Math.abs(own?.residualMm ?? 0)).toBeGreaterThanOrEqual(
              own?.thresholdMm ?? Infinity,
            );
          }
          if (report.status === 'ok') {
            expect(report.monotonicity).toEqual([]);
            expect(report.suspect).toBeUndefined();
          }
          if (report.monotonicity.length > 0) expect(report.status).toBe('inconsistent');
        },
      ),
    );
  });
});
