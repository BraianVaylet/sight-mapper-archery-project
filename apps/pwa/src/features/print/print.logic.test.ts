import type { SightScale } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../distances/distances.logic.js';
import { analyse } from '../sight/sight.logic.js';
import { printSheet } from './print.logic.js';

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
  windageMm: null,
  origin: 'measured',
  measuredAt: '2026-11-03T12:00:00Z',
});

const HUNTER = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6), mark(50, 2.6), mark(60, 3.6)];
const sheet = (marks: Mark[], from: number, to: number, step: 1 | 2 | 5 | 10 = 5) =>
  printSheet(buildGrid(analyse(marks, CM), { from, to, step }, 'metric'));

describe('the printable list (HU-CAL-05)', () => {
  it('lists 20 to 60 every 5 with the measured ones plain and the rest marked as estimates', () => {
    const s = sheet(HUNTER, 20, 60);
    expect(s.rows.map((r) => r.distance)).toEqual([20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(s.rows.map((r) => r.measured)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(s.hasEstimates).toBe(true);
    expect(s.omitted).toBe(0);
  });

  it('prints what was loaded exactly, as loaded', () => {
    const s = sheet(HUNTER, 20, 60, 10);
    expect(s.rows.map((r) => r.reading)).toEqual([0.3, 0.8, 1.6, 2.6, 3.6]);
    expect(s.hasEstimates).toBe(false);
  });

  it('has no estimate to footnote when every row was measured', () => {
    const s = sheet(HUNTER, 20, 60, 10);
    expect(s.hasEstimates).toBe(false);
    expect(s.hasCautions).toBe(false);
  });

  it('leaves out the distances the marks do not allow and counts them (2 marks: no extrapolation)', () => {
    const s = sheet([mark(20, 0.3), mark(40, 1.6)], 20, 60, 10);
    expect(s.rows.map((r) => r.distance)).toEqual([20, 30, 40]);
    expect(s.omitted).toBe(2);
  });

  it('flags to confirm at the range an estimate with low confidence far from the marks', () => {
    const s = sheet(HUNTER, 10, 90, 10);
    const far = s.rows.filter((r) => !r.measured && r.caution);
    expect(far.length).toBeGreaterThan(0);
    expect(s.hasCautions).toBe(true);
    // Measured rows are never doubted.
    expect(s.rows.filter((r) => r.measured).every((r) => !r.caution)).toBe(true);
  });

  it('is empty, not broken, when the range does not make sense', () => {
    const s = sheet(HUNTER, 60, 20);
    expect(s).toEqual({
      rows: [],
      omitted: 0,
      hasEstimates: false,
      hasCautions: false,
      columns: { windage: false },
    });
  });
});

describe('windage on the printable list (F1-42)', () => {
  const WINDAGE: SightScale = { ...CM, unit: 'mm', min: -10, max: 10, resolution: 0.5 };
  const windy = [{ ...mark(20, 0.3), windageMm: 2.5 }, mark(30, 0.8), mark(40, 1.6)];
  const withWindage = (scale: SightScale | null) =>
    printSheet(buildGrid(analyse(windy, CM), { from: 20, to: 40, step: 5 }, 'metric'), {
      marks: windy,
      scale,
    });

  it('prints the windage of the measured marks that have one, as a reading', () => {
    const s = withWindage(WINDAGE);
    expect(s.columns.windage).toBe(true);
    expect(s.rows.map((r) => r.windage)).toEqual([2.5, null, null, null, null]);
  });

  it('never gives a calculated row a windage', () => {
    const s = withWindage(WINDAGE);
    expect(s.rows.filter((r) => !r.measured).every((r) => r.windage === null)).toBe(true);
  });

  it('has no windage column for a sight without a horizontal scale', () => {
    expect(withWindage(null).columns.windage).toBe(false);
  });

  it('has no windage column when no printed mark has one', () => {
    expect(sheet(HUNTER, 20, 60).columns.windage).toBe(false);
  });
});
