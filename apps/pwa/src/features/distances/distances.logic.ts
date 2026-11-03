import { DomainError, gridDistances, toCanonical } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import type { UnitSystem } from '@sight-mapper/types';
import {
  distanceIn,
  readDistance,
  type Reading,
  type SightAnalysis,
} from '../sight/sight.logic.js';

/** The steps the archer can pick, in their unit (UX-UI §4.3). */
export const STEPS = [1, 2, 5, 10] as const;
export type Step = (typeof STEPS)[number];
export const DEFAULT_STEP: Step = 5;

/** A table longer than this is not a table anyone reads: the range asks to be narrowed. */
export const MAX_ROWS = 200;
/** The farthest an archer can shoot (RN-MRK-01), in metres. */
const MAX_DISTANCE_M = 300;

const unitOf = (system: UnitSystem) => (system === 'metric' ? 'm' : 'yd');
export const toMetres = (distance: number, system: UnitSystem): number =>
  toCanonical('distance', distance, unitOf(system));

export const isStep = (value: number): value is Step =>
  (STEPS as readonly number[]).includes(value);

export type Range = { from: number; to: number; step: Step };

/**
 * The range the screen opens with: from the nearest to the farthest measured mark, in whole units
 * of the archer, on the step they have (or the default one). With a single mark both ends meet.
 */
export function defaultRange(
  marks: readonly Mark[],
  system: UnitSystem,
  step: Step = DEFAULT_STEP,
): Range {
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (first === undefined || last === undefined) return { from: step, to: step * 2, step };
  const from = Math.ceil(distanceIn(first.distanceM, system));
  const to = Math.floor(distanceIn(last.distanceM, system));
  return to < from ? { from, to: from, step } : { from, to, step };
}

export type GridRow = {
  /** In the archer's unit: what the table shows. */
  readonly distance: number;
  readonly distanceM: number;
  readonly reading: Reading;
};

export type GridResult =
  | { readonly ok: true; readonly rows: readonly GridRow[] }
  | { readonly ok: false; readonly error: 'range' | 'tooMany' };

/**
 * The table of intermediates: `from + k * step` in the archer's unit (never metres converted and
 * rounded), each one asked of the model. A distance the marks do not allow comes back as its own
 * failure, so the table says why instead of leaving a hole.
 */
export function buildGrid(analysis: SightAnalysis, range: Range, system: UnitSystem): GridResult {
  const { from, to, step } = range;
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to < from) {
    return { ok: false, error: 'range' };
  }
  if ((to - from) / step + 1 > MAX_ROWS) return { ok: false, error: 'tooMany' };
  let distances: number[];
  try {
    distances = gridDistances(from, to, step);
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: 'range' };
    throw error;
  }
  return {
    ok: true,
    rows: distances.map((distance) => {
      const distanceM = toMetres(distance, system);
      return { distance, distanceM, reading: analysis.readingAt(distanceM) };
    }),
  };
}

export type FreeQuery =
  | { readonly ok: true; readonly distanceM: number; readonly reading: Reading }
  | { readonly ok: false; readonly error: 'required' | 'number' | 'range' };

/** "Get reading": one distance typed by the archer, asked of the model. Nothing is stored. */
export function freeQuery(analysis: SightAnalysis, text: string, system: UnitSystem): FreeQuery {
  if (text.trim() === '') return { ok: false, error: 'required' };
  const distanceM = readDistance(text, system);
  if (distanceM === null) return { ok: false, error: 'number' };
  if (distanceM <= 0 || distanceM > MAX_DISTANCE_M) return { ok: false, error: 'range' };
  return { ok: true, distanceM, reading: analysis.readingAt(distanceM) };
}

// --- the curve ---------------------------------------------------------------------------------

export type CurveSize = { width: number; height: number };
const PAD = { left: 44, right: 14, top: 14, bottom: 36 } as const;

export type CurvePoint = {
  readonly key: string;
  readonly distance: number;
  readonly reading: number;
  readonly measured: boolean;
  readonly x: number;
  readonly y: number;
};
export type CurveSegment = {
  readonly from: CurvePoint;
  readonly to: CurvePoint;
  readonly solid: boolean;
};
export type CurveTick = { readonly value: number; readonly at: number };
export type CurveGeometry = {
  readonly plot: { left: number; right: number; top: number; bottom: number };
  readonly points: readonly CurvePoint[];
  /** Between two measured points the line is solid; anything else is dashed (HU-CAL-02). */
  readonly segments: readonly CurveSegment[];
  readonly xTicks: readonly CurveTick[];
  readonly yTicks: readonly CurveTick[];
  /** The free query, drawn apart from the line: a diamond that is not a mark. */
  readonly query: CurvePoint | undefined;
};

/** Round-number ticks inside `[min, max]`: 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!(max > min)) return [min];
  const rough = (max - min) / Math.max(1, target);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10] as const).map((m) => m * power).find((s) => s >= rough) ?? rough;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const ticks: number[] = [];
  for (let k = Math.ceil(min / step - 1e-9); k * step <= max + 1e-9; k++) {
    ticks.push(Number((k * step).toFixed(decimals)));
  }
  return ticks;
}

/** At most `limit` of the distances, evenly spread, always keeping the first and the last. */
function thin<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  const out: T[] = [];
  for (let i = 0; i < limit; i++)
    out.push(items[Math.round((i * (items.length - 1)) / (limit - 1))] as T);
  return out;
}

/**
 * Where everything goes in the chart: the rows that have a reading become points (distance on x,
 * what the archer reads on y), joined by segments, plus the free query if there is one. All of
 * it is arithmetic on numbers the domain produced; the component only draws.
 */
export function curveGeometry(
  rows: readonly GridRow[],
  size: CurveSize,
  query?: { distance: number; reading: number },
): CurveGeometry {
  const plot = {
    left: PAD.left,
    right: size.width - PAD.right,
    top: PAD.top,
    bottom: size.height - PAD.bottom,
  };
  const ok = rows.flatMap((row) => (row.reading.ok ? [{ row, reading: row.reading }] : []));
  const xs = [...ok.map(({ row }) => row.distance), ...(query ? [query.distance] : [])];
  const ys = [...ok.map(({ reading }) => reading.reading), ...(query ? [query.reading] : [])];
  if (xs.length === 0) {
    return { plot, points: [], segments: [], xTicks: [], yTicks: [], query: undefined };
  }
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const spanX = x1 > x0 ? x1 - x0 : 1;
  const spanY = y1 > y0 ? y1 - y0 : 1;
  // A little air above and below, so a point on the edge is not cut by the frame.
  const lo = y1 > y0 ? y0 - spanY * 0.06 : y0 - 0.5;
  const hi = y1 > y0 ? y1 + spanY * 0.06 : y1 + 0.5;
  const xOf = (distance: number) =>
    plot.left + ((distance - (x1 > x0 ? x0 : x0 - 0.5)) / spanX) * (plot.right - plot.left);
  const yOf = (reading: number) =>
    plot.bottom - ((reading - lo) / (hi - lo)) * (plot.bottom - plot.top);

  const make = (key: string, distance: number, reading: number, measured: boolean): CurvePoint => ({
    key,
    distance,
    reading,
    measured,
    x: xOf(distance),
    y: yOf(reading),
  });
  const points = ok.map(({ row, reading }) =>
    make(`d${row.distance}`, row.distance, reading.reading, reading.kind === 'measured'),
  );
  // A failed row in between breaks the line: nothing is drawn across what the marks do not allow.
  const segments: CurveSegment[] = [];
  const index = new Map(points.map((point) => [point.distance, point]));
  for (let i = 1; i < rows.length; i++) {
    const a = index.get((rows[i - 1] as GridRow).distance);
    const b = index.get((rows[i] as GridRow).distance);
    if (a !== undefined && b !== undefined) {
      segments.push({ from: a, to: b, solid: a.measured && b.measured });
    }
  }
  return {
    plot,
    points,
    segments,
    xTicks: thin(
      ok.map(({ row }) => row.distance),
      7,
    ).map((value) => ({ value, at: xOf(value) })),
    yTicks: niceTicks(lo, hi, 5).map((value) => ({ value, at: yOf(value) })),
    query: query ? make('query', query.distance, query.reading, false) : undefined,
  };
}
