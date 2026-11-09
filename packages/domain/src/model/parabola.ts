import { DomainError } from '../errors.js';
import type { MarkPoint } from './types.js';

export type Parabola = {
  evaluate(distanceM: number): number;
  /** Slope in mm per metre. */
  derivative(distanceM: number): number;
  /** Distance of the vertex, or `null` when the fit is (numerically) a straight line. */
  readonly vertexM: number | null;
};

/** Curvature below this (mm per scaled unit squared) is treated as a straight line. */
const FLAT_CURVATURE = 1e-9;

/**
 * Least-squares parabola over all points (SIGHT-MATH §6). Fitted on `x = (d - mean) / s` for
 * numerical stability; the 3x3 normal system is solved by Cramer's rule. With three points the
 * parabola interpolates exactly.
 */
export function fitParabola(points: readonly MarkPoint[]): Parabola {
  const n = points.length;
  const distinct = new Set(points.map((p) => p.distanceM)).size;
  if (distinct < 3) throw new DomainError('A parabola needs three distinct distances');

  const mean = points.reduce((acc, p) => acc + p.distanceM, 0) / n;
  const variance = points.reduce((acc, p) => acc + (p.distanceM - mean) ** 2, 0) / n;
  const scale = Math.sqrt(variance);

  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let t0 = 0;
  let t1 = 0;
  let t2 = 0;
  for (const p of points) {
    const x = (p.distanceM - mean) / scale;
    const x2 = x * x;
    s1 += x;
    s2 += x2;
    s3 += x2 * x;
    s4 += x2 * x2;
    t0 += p.valueMm;
    t1 += x * p.valueMm;
    t2 += x2 * p.valueMm;
  }

  // [s4 s3 s2][a]   [t2]
  // [s3 s2 s1][b] = [t1]
  // [s2 s1 n ][c]   [t0]
  const det = det3(s4, s3, s2, s3, s2, s1, s2, s1, n);
  const a = det3(t2, s3, s2, t1, s2, s1, t0, s1, n) / det;
  const b = det3(s4, t2, s2, s3, t1, s1, s2, t0, n) / det;
  const c = det3(s4, s3, t2, s3, s2, t1, s2, s1, t0) / det;

  const vertexM = Math.abs(a) < FLAT_CURVATURE ? null : mean + scale * (-b / (2 * a));

  return {
    evaluate(distanceM) {
      const x = (distanceM - mean) / scale;
      return (a * x + b) * x + c;
    },
    derivative(distanceM) {
      const x = (distanceM - mean) / scale;
      return (2 * a * x + b) / scale;
    },
    vertexM,
  };
}

function det3(
  a11: number,
  a12: number,
  a13: number,
  a21: number,
  a22: number,
  a23: number,
  a31: number,
  a32: number,
  a33: number,
): number {
  return (
    a11 * (a22 * a33 - a23 * a32) - a12 * (a21 * a33 - a23 * a31) + a13 * (a21 * a32 - a22 * a31)
  );
}
