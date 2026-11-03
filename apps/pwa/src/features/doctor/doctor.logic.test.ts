import type { SightScale } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import { describe, expect, it } from 'vitest';
import { analyse } from '../sight/sight.logic.js';
import { doctorView } from './doctor.logic.js';

const CM: SightScale = {
  unit: 'cm',
  unitSizeMm: null,
  min: 0,
  max: 10,
  resolution: 0.1,
  direction: 'down',
};

const mark = (distanceM: number, reading: number): Mark => ({
  id: `m-${distanceM}`,
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

const view = (marks: Mark[]) => doctorView(marks, analyse(marks, CM), CM);

// The author's good set (Goldtip Hunter 400).
const HUNTER = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6), mark(50, 2.6), mark(60, 3.6)];

describe("the Mark Doctor in the archer's terms (HU-CAL-04)", () => {
  it('has nothing to say with fewer than 2 marks', () => {
    const v = view([mark(30, 0.8)]);
    expect(v.status).toBe('insufficient');
    expect(v.level).toBe('none');
    expect(v.rows).toHaveLength(1);
    expect(v.suspect).toBeUndefined();
  });

  it('calls consistent marks consistent, with a deviation for each one under its tolerance', () => {
    const v = view(HUNTER);
    expect(v.status).toBe('ok');
    expect(v.level).toBe('full');
    expect(v.rows.map((r) => r.state)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    for (const row of v.rows) {
      expect(row.deviation).toBeDefined();
      expect(Math.abs(row.deviation ?? 99)).toBeLessThan(row.tolerance ?? 0);
    }
  });

  it('points at the mark that is 0.8 cm off the trend and says by how much, in cm of the sight', () => {
    const v = view([mark(20, 0.3), mark(30, 0.8), mark(40, 2.4), mark(50, 2.6), mark(60, 3.6)]);
    expect(v.status).toBe('suspect');
    expect(v.suspect?.distanceM).toBe(40);
    // Readings above the trend: positive, and about the 0.8 that was added (never in mm).
    expect(v.suspect?.delta).toBeGreaterThan(0.6);
    expect(v.suspect?.delta).toBeLessThan(1.2);
    expect(v.rows.find((r) => r.distanceM === 40)?.state).toBe('suspect');
  });

  it('does not touch the marks: the same numbers go in and the same come out', () => {
    const marks = [mark(20, 0.3), mark(30, 0.8), mark(40, 2.4), mark(50, 2.6), mark(60, 3.6)];
    const before = JSON.stringify(marks);
    const v = view(marks);
    expect(JSON.stringify(marks)).toBe(before);
    expect(v.rows.find((r) => r.distanceM === 40)?.reading).toBeCloseTo(2.4, 10);
  });

  it('flags a pair that moves the wrong way from 2 marks on, without waiting for 5', () => {
    const v = view([mark(20, 0.3), mark(30, 1.0), mark(40, 0.9)]);
    expect(v.status).toBe('inconsistent');
    expect(v.level).toBe('monotonicity');
    expect(v.breaks).toEqual([{ fromM: 30, toM: 40 }]);
    expect(v.rows.map((r) => r.state)).toEqual(['ok', 'inconsistent', 'inconsistent']);
    // Below 5 marks there is no trend to measure against.
    expect(v.rows.every((r) => r.deviation === undefined)).toBe(true);
  });

  it('keeps the rows nearest first whatever order the marks come in', () => {
    const v = view([...HUNTER].reverse());
    expect(v.rows.map((r) => r.distanceM)).toEqual([20, 30, 40, 50, 60]);
  });
});
