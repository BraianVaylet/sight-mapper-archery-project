import { MAX_GRID_ROWS, MEASURED_SNAP_M } from '../constants.js';
import { DomainError, type CalcFailure } from '../errors.js';
import type { CalcSuccess, MarkModel } from './types.js';

export type ScaleBoundsMm = { readonly minMm: number; readonly maxMm: number };

export type DistanceRow =
  | (Omit<CalcSuccess, 'valueMm'> & {
      readonly distanceM: number;
      readonly scaleValueMm: number;
      readonly outOfScale: boolean;
    })
  | (CalcFailure & { readonly distanceM: number });

export type GridRequest = {
  /** In the archer's unit (m or yd). */
  readonly from: number;
  readonly to: number;
  readonly step: number;
  /** Metres per archer unit: 1 for m, 0.9144 for yd. */
  readonly unitToMeters: number;
  readonly scale?: ScaleBoundsMm;
};

/**
 * Grid of distances in the archer's unit, recomputed from the origin: `d_k = from + k * step`
 * (SIGHT-MATH §9). Accumulating `d += step` would drift.
 */
export function gridDistances(from: number, to: number, step: number): number[] {
  if (![from, to, step].every(Number.isFinite)) {
    throw new DomainError('Grid bounds and step must be finite numbers');
  }
  if (step <= 0) throw new DomainError('Grid step must be greater than zero');
  if (to < from) throw new DomainError('Grid end must not be before its start');

  // The epsilon absorbs float noise in the quotient (0.3 / 0.1 = 2.9999999999999996).
  const last = Math.floor((to - from) / step + 1e-9);
  if (last + 1 > MAX_GRID_ROWS) throw new DomainError('Grid has too many rows');

  const out: number[] = [];
  for (let k = 0; k <= last; k++) out.push(from + k * step);
  return out;
}

/** Evaluates one distance. A mark within 1 mm of a measured one is that measured mark. */
export function queryDistance(
  model: MarkModel,
  distanceM: number,
  scale?: ScaleBoundsMm,
): DistanceRow {
  const near = model.points.find((p) => Math.abs(p.distanceM - distanceM) <= MEASURED_SNAP_M);
  const result = near === undefined ? model.markAt(distanceM) : model.markAt(near.distanceM);

  if (!result.ok) return { ...result, distanceM };

  return {
    ok: true,
    distanceM,
    scaleValueMm: result.valueMm,
    kind: result.kind,
    lowConfidence: result.lowConfidence,
    outOfScale:
      scale !== undefined && (result.valueMm < scale.minMm || result.valueMm > scale.maxMm),
  };
}

export function calculateGrid(model: MarkModel, request: GridRequest): DistanceRow[] {
  const { from, to, step, unitToMeters, scale } = request;
  return gridDistances(from, to, step).map((d) => queryDistance(model, d * unitToMeters, scale));
}
