import type { SightScale } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import { describe, expect, it } from 'vitest';
import { analyse } from '../sight/sight.logic.js';
import {
  buildGrid,
  curveGeometry,
  defaultRange,
  freeQuery,
  isStep,
  MAX_ROWS,
  niceTicks,
} from './distances.logic.js';

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

// The author's good set (Goldtip Hunter 400).
const HUNTER = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6), mark(50, 2.6), mark(60, 3.6)];
const TWO = [mark(20, 0.3), mark(40, 1.6)];

describe('the range the screen opens with', () => {
  it('goes from the nearest to the farthest measured mark', () => {
    expect(defaultRange(HUNTER, 'metric')).toEqual({ from: 20, to: 60, step: 5 });
  });

  it('is in whole yards for an archer in yards, never metres converted back', () => {
    // 20 m = 21.87 yd, 60 m = 65.62 yd: only the yards inside the measured span.
    expect(defaultRange(HUNTER, 'imperial')).toEqual({ from: 22, to: 65, step: 5 });
  });

  it('keeps the step the archer picked', () => {
    expect(defaultRange(HUNTER, 'metric', 10).step).toBe(10);
  });

  it('does not invert with a single mark', () => {
    expect(defaultRange([mark(30, 0.8)], 'metric')).toEqual({ from: 30, to: 30, step: 5 });
  });

  it('knows which steps exist', () => {
    expect([1, 2, 5, 10].every(isStep)).toBe(true);
    expect(isStep(3)).toBe(false);
  });
});

describe('the table of intermediates (HU-CAL-02)', () => {
  const analysis = analyse(HUNTER, CM);

  it('lists 20, 25 … 60 m: measured as loaded, the rest estimated', () => {
    const grid = buildGrid(analysis, { from: 20, to: 60, step: 5 }, 'metric');
    expect(grid.ok).toBe(true);
    if (!grid.ok) return;
    expect(grid.rows.map((r) => r.distance)).toEqual([20, 25, 30, 35, 40, 45, 50, 55, 60]);
    const kinds = grid.rows.map((r) => (r.reading.ok ? r.reading.kind : 'failed'));
    expect(kinds).toEqual([
      'measured',
      'interpolated',
      'measured',
      'interpolated',
      'measured',
      'interpolated',
      'measured',
      'interpolated',
      'measured',
    ]);
    // What was measured comes back exactly as loaded.
    const at30 = grid.rows[2]?.reading;
    expect(at30?.ok && at30.reading).toBe(0.8);
  });

  it('is a grid in yards: 20, 25, 30 yd, each asked at its own metres', () => {
    const grid = buildGrid(analysis, { from: 25, to: 35, step: 5 }, 'imperial');
    expect(grid.ok && grid.rows.map((r) => r.distance)).toEqual([25, 30, 35]);
    expect(grid.ok && grid.rows.map((r) => Number(r.distanceM.toFixed(4)))).toEqual([
      22.86, 27.432, 32.004,
    ]);
  });

  it('says why a distance is not allowed instead of leaving a hole (2 marks: no extrapolation)', () => {
    const grid = buildGrid(analyse(TWO, CM), { from: 20, to: 50, step: 10 }, 'metric');
    expect(grid.ok).toBe(true);
    if (!grid.ok) return;
    const last = grid.rows[3]?.reading;
    expect(last?.ok).toBe(false);
    expect(!last?.ok && last?.code).toBe('SM-CALC-422-002');
  });

  it('refuses a range that is backwards, empty or too long', () => {
    expect(buildGrid(analysis, { from: 60, to: 20, step: 5 }, 'metric')).toEqual({
      ok: false,
      error: 'range',
    });
    expect(buildGrid(analysis, { from: 0, to: 20, step: 5 }, 'metric')).toEqual({
      ok: false,
      error: 'range',
    });
    expect(buildGrid(analysis, { from: 1, to: MAX_ROWS + 10, step: 1 }, 'metric')).toEqual({
      ok: false,
      error: 'tooMany',
    });
  });
});

describe('the free query (HU-CAL-03)', () => {
  const analysis = analyse(HUNTER, CM);

  it('estimates 45 m and leaves the marks as they were', () => {
    const before = JSON.stringify(HUNTER);
    const result = freeQuery(analysis, '45', 'metric');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.distanceM).toBe(45);
    expect(result.reading.ok && result.reading.kind).toBe('interpolated');
    expect(JSON.stringify(HUNTER)).toBe(before);
  });

  it('reads a decimal comma and yards', () => {
    expect(freeQuery(analysis, '45,5', 'metric').ok).toBe(true);
    const yards = freeQuery(analysis, '50', 'imperial');
    expect(yards.ok && yards.distanceM).toBeCloseTo(45.72, 5);
  });

  it('asks for a number, and for one that can be shot', () => {
    expect(freeQuery(analysis, '', 'metric')).toEqual({ ok: false, error: 'required' });
    expect(freeQuery(analysis, 'cerca', 'metric')).toEqual({ ok: false, error: 'number' });
    expect(freeQuery(analysis, '0', 'metric')).toEqual({ ok: false, error: 'range' });
    expect(freeQuery(analysis, '400', 'metric')).toEqual({ ok: false, error: 'range' });
  });

  it('answers with the tier failure when the marks do not reach that far', () => {
    const result = freeQuery(analyse(TWO, CM), '50', 'metric');
    expect(result.ok && !result.reading.ok && result.reading.code).toBe('SM-CALC-422-002');
  });
});

describe('the curve', () => {
  const size = { width: 320, height: 220 };
  const rows = (() => {
    const grid = buildGrid(analyse(HUNTER, CM), { from: 20, to: 60, step: 10 }, 'metric');
    if (!grid.ok) throw new Error('grid');
    return grid.rows;
  })();

  it('puts every row inside the plot, nearer to the left and higher readings higher up', () => {
    const { plot, points } = curveGeometry(rows, size);
    expect(points).toHaveLength(5);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(plot.left);
      expect(p.x).toBeLessThanOrEqual(plot.right);
      expect(p.y).toBeGreaterThanOrEqual(plot.top);
      expect(p.y).toBeLessThanOrEqual(plot.bottom);
    }
    const [first, last] = [points[0], points[4]];
    expect(first?.x).toBeLessThan(last?.x ?? 0);
    expect(first?.y).toBeGreaterThan(last?.y ?? 0);
  });

  it('draws measured to measured solid, and anything with an estimate dashed', () => {
    const geometry = curveGeometry(rows, size);
    expect(geometry.segments.every((s) => s.solid)).toBe(true);
    const fine = buildGrid(analyse(HUNTER, CM), { from: 20, to: 40, step: 5 }, 'metric');
    if (!fine.ok) throw new Error('grid');
    expect(curveGeometry(fine.rows, size).segments.map((s) => s.solid)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('breaks the line where the marks do not allow an answer', () => {
    const grid = buildGrid(analyse(TWO, CM), { from: 20, to: 50, step: 10 }, 'metric');
    if (!grid.ok) throw new Error('grid');
    const geometry = curveGeometry(grid.rows, size);
    expect(geometry.points.map((p) => p.distance)).toEqual([20, 30, 40]);
    expect(geometry.segments).toHaveLength(2);
  });

  it('places the free query apart from the line, as an estimate', () => {
    const geometry = curveGeometry(rows, size, { distance: 45, reading: 2.1 });
    expect(geometry.query?.measured).toBe(false);
    expect(geometry.points.some((p) => p.key === 'query')).toBe(false);
  });

  it('draws nothing when there is nothing to draw', () => {
    expect(curveGeometry([], size).points).toEqual([]);
  });

  it('ticks round numbers inside the range', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0.3, 3.6, 5)).toEqual([1, 2, 3]);
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(2, 2)).toEqual([2]);
  });

  it('keeps tick labels to a handful however long the table', () => {
    const grid = buildGrid(analyse(HUNTER, CM), { from: 20, to: 60, step: 1 }, 'metric');
    if (!grid.ok) throw new Error('grid');
    const { xTicks } = curveGeometry(grid.rows, size);
    expect(xTicks.length).toBeLessThanOrEqual(7);
    expect(xTicks[0]?.value).toBe(20);
    expect(xTicks.at(-1)?.value).toBe(60);
  });
});
