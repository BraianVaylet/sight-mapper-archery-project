import {
  CALC_MIN_MARKS_EXTRAPOLATE,
  CALC_MIN_MARKS_INTERPOLATE,
  EXTRAPOLATION_WARN_RATIO,
} from '../constants.js';
import { DomainError, type CalcFailure } from '../errors.js';
import { fitParabola, type Parabola } from './parabola.js';
import { createPchip } from './pchip.js';
import { preprocess } from './preprocess.js';
import type { CalcResult, MarkModel, MarkPoint } from './types.js';

/**
 * Builds the empirical mark model (ADR-001): it passes exactly through every measured mark,
 * interpolates with PCHIP inside the measured range and extrapolates with an anchored parabola
 * outside it, always flagged as estimated.
 *
 * `marks` are the measured, non-deleted marks of one (setup, arrow set) pair, in metres and
 * millimetres. Order and repeated distances do not matter.
 */
export function createMarkModel(marks: readonly MarkPoint[]): MarkModel {
  const points = preprocess(marks);
  const n = points.length;
  const first = points[0];
  const last = points[n - 1];

  const pchip = n >= CALC_MIN_MARKS_INTERPOLATE ? createPchip(points) : null;
  const parabola = n >= CALC_MIN_MARKS_EXTRAPOLATE ? fitParabola(points) : null;

  const fail = (code: CalcFailure['code'], have: number, need: number): CalcFailure => ({
    ok: false,
    code,
    params: { have, need },
  });

  return {
    points,
    markAt(distanceM: number): CalcResult {
      if (!Number.isFinite(distanceM) || distanceM <= 0) {
        throw new DomainError('Query distance must be a finite number greater than zero');
      }
      if (first === undefined || last === undefined) {
        return fail('SM-CALC-422-001', n, CALC_MIN_MARKS_INTERPOLATE);
      }

      const exact = points.find((p) => p.distanceM === distanceM);
      if (exact !== undefined) {
        return { ok: true, valueMm: exact.valueMm, kind: 'measured', lowConfidence: false };
      }

      if (pchip === null) return fail('SM-CALC-422-001', n, CALC_MIN_MARKS_INTERPOLATE);

      if (distanceM > first.distanceM && distanceM < last.distanceM) {
        return { ok: true, valueMm: pchip(distanceM), kind: 'interpolated', lowConfidence: false };
      }

      if (parabola === null) return fail('SM-CALC-422-002', n, CALC_MIN_MARKS_EXTRAPOLATE);
      return extrapolate(parabola, first, last, distanceM);
    },
  };
}

function extrapolate(
  parabola: Parabola,
  first: MarkPoint,
  last: MarkPoint,
  distanceM: number,
): CalcResult {
  const above = distanceM > last.distanceM;
  const anchor = above ? last : first;
  const { vertexM } = parabola;

  // The parabola turns around at its vertex: past it the extension would reverse direction.
  if (vertexM !== null) {
    const turnsBefore = above
      ? vertexM >= anchor.distanceM && vertexM < distanceM
      : vertexM <= anchor.distanceM && vertexM > distanceM;
    if (turnsBefore) {
      return { ok: false, code: 'SM-CALC-422-004', params: { maxDistanceM: vertexM } };
    }
  }

  const range = last.distanceM - first.distanceM;
  const overshoot = above ? distanceM - last.distanceM : first.distanceM - distanceM;
  return {
    ok: true,
    valueMm: anchor.valueMm + (parabola.evaluate(distanceM) - parabola.evaluate(anchor.distanceM)),
    kind: 'extrapolated',
    lowConfidence: overshoot > EXTRAPOLATION_WARN_RATIO * range,
  };
}
