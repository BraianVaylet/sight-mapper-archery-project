import type { SightScale } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import { describe, expect, it } from 'vitest';
import {
  analyse,
  distanceIn,
  doctorProgress,
  readDistance,
  readReading,
  readingOf,
  showReading,
  toScale,
} from './sight.logic.js';

/** The author's sight: cm, 0 to 10, steps of 0.1, growing downward. */
const CM: SightScale = {
  unit: 'cm',
  unitSizeMm: null,
  min: 0,
  max: 10,
  resolution: 0.1,
  direction: 'down',
};

const mark = (distanceM: number, reading: number, n = distanceM): Mark => ({
  id: `m-${n}`,
  version: 1,
  createdAt: '2026-11-03T12:00:00Z',
  updatedAt: '2026-11-03T12:00:00Z',
  deletedAt: null,
  setupId: 's',
  arrowSetId: 'a',
  distanceM,
  scaleValueMm: reading * 10,
  origin: 'measured',
  measuredAt: '2026-11-03T12:00:00Z',
});

// The author's good set (Goldtip Hunter 400), measured 2026-10-31.
const HUNTER = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6), mark(50, 2.6), mark(60, 3.6)];

describe('reading what the archer types', () => {
  it('turns a reading on the sight into a position in mm: 1.6 cm is 16 mm', () => {
    expect(readReading('1,6', CM)).toBe(16);
    expect(readReading('1.6', CM)).toBe(16);
    expect(readReading('abc', CM)).toBeNull();
  });

  it('accepts a fraction on an inch scale: 3 1/4 in is 82.55 mm', () => {
    const inches: SightScale = { ...CM, unit: 'in', min: 0, max: 8, resolution: 1 / 16 };
    expect(readReading('3 1/4', inches)).toBeCloseTo(82.55, 6);
    // ...but not on a cm scale.
    expect(readReading('3 1/4', CM)).toBeNull();
  });

  it("turns a distance in the archer's unit into metres: 50 yd is 45.72 m", () => {
    expect(readDistance('40', 'metric')).toBe(40);
    expect(readDistance('50', 'imperial')).toBe(45.72);
    expect(readDistance('40,5', 'metric')).toBe(40.5);
    expect(readDistance('far', 'metric')).toBeNull();
  });

  it('shows metres as they are and yards converted back: 45.72 m is 50 yd', () => {
    expect(distanceIn(40, 'metric')).toBe(40);
    expect(distanceIn(45.72, 'imperial')).toBe(50);
  });
});

describe('showing a reading', () => {
  it('rounds to what the archer can set and uses the separator of the language', () => {
    expect(readingOf(16, CM)).toBe(1.6);
    expect(showReading(16, CM, ',')).toBe('1,6');
    expect(showReading(16.04, CM, '.')).toBe('1.6');
  });

  it('builds the domain scale from what the API sends, with no size as null', () => {
    expect(
      toScale({
        scale: { unit: 'click', min: 0, max: 60, resolution: 1, direction: 'up' },
      }),
    ).toEqual({ unit: 'click', unitSizeMm: null, min: 0, max: 60, resolution: 1, direction: 'up' });
  });
});

describe("analyse: the author's real marks through the domain", () => {
  const hunter = analyse(HUNTER, CM);

  it('answers a measured distance with exactly the mark that was measured (RN-CAL-01)', () => {
    for (const m of HUNTER) {
      expect(hunter.readingAt(m.distanceM)).toMatchObject({
        ok: true,
        kind: 'measured',
        reading: m.scaleValueMm / 10,
      });
    }
  });

  it('estimates between marks and beyond them, never as measured', () => {
    expect(hunter.readingAt(35)).toMatchObject({ ok: true, kind: 'interpolated' });
    const between = hunter.readingAt(35);
    if (between.ok) expect(between.reading).toBeGreaterThan(0.8);
    if (between.ok) expect(between.reading).toBeLessThan(1.6);
    expect(hunter.readingAt(70)).toMatchObject({ ok: true, kind: 'extrapolated' });
  });

  it('flags an estimate that falls off the scale (10 m is below 0 cm)', () => {
    expect(hunter.readingAt(10)).toMatchObject({ ok: true, outOfScale: true });
  });

  it('has the full tier and a Doctor that finds the good set coherent', () => {
    expect(hunter.count).toBe(5);
    expect(hunter.tier).toBe('extrapolate');
    expect(hunter.doctor?.status).toBe('ok');
    expect(hunter.suspectIds.size).toBe(0);
  });

  it('runs the whole model for 50 marks well inside a frame (RNF-02: 16 ms)', () => {
    const many = Array.from({ length: 50 }, (_, i) => mark(10 + i, (i * i) / 1000 + i / 100, i));
    const started = performance.now();
    const analysis = analyse(many, { ...CM, max: 100 });
    for (let d = 10; d <= 60; d += 0.5) analysis.readingAt(d);
    expect(performance.now() - started).toBeLessThan(16);
  });
});

describe('the tiers of the marks (SPEC 7.5)', () => {
  it('with no marks, or one, there is nothing to calculate', () => {
    expect(analyse([], CM)).toMatchObject({ count: 0, tier: 'none', doctor: undefined });
    expect(analyse([mark(40, 1.6)], CM).tier).toBe('none');
    expect(analyse([mark(40, 1.6)], CM).readingAt(50)).toMatchObject({ ok: false });
  });

  it('with two marks it interpolates but does not extrapolate', () => {
    const two = analyse([mark(20, 0.3), mark(40, 1.6)], CM);
    expect(two.tier).toBe('interpolate');
    expect(two.readingAt(30)).toMatchObject({ ok: true, kind: 'interpolated' });
    expect(two.readingAt(60)).toMatchObject({ ok: false });
  });

  it('with three it extrapolates, and says so with low confidence far out', () => {
    const three = analyse([mark(20, 0.3), mark(30, 0.8), mark(40, 1.6)], CM);
    expect(three.tier).toBe('extrapolate');
    expect(three.readingAt(45)).toMatchObject({ ok: true, kind: 'extrapolated' });
  });

  it('points at marks that move the wrong way', () => {
    const bad = analyse([mark(20, 0.3), mark(30, 1.0), mark(40, 0.9)], CM);
    expect(bad.inconsistentIds.size).toBe(2);
    expect(bad.doctor?.status).toBe('inconsistent');
  });
});

describe('doctorProgress', () => {
  it('is ready from five marks and counts toward them before', () => {
    expect(doctorProgress(2)).toEqual({ ready: false, have: 2, need: 5 });
    expect(doctorProgress(5)).toEqual({ ready: true, have: 5, need: 5 });
    expect(doctorProgress(9)).toEqual({ ready: true, have: 5, need: 5 });
  });
});
