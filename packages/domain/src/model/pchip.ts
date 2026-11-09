import { DomainError } from '../errors.js';
import type { MarkPoint } from './types.js';

/**
 * Monotone piecewise cubic Hermite interpolation with Fritsch–Carlson tangents (SIGHT-MATH §5).
 * `points` must be sorted with unique distances (see `preprocess`). Passes exactly through every
 * point and never overshoots between them.
 */
export function createPchip(points: readonly MarkPoint[]): (distanceM: number) => number {
  const n = points.length;
  if (n < 2) throw new DomainError('PCHIP needs at least two points');

  const xs = points.map((p) => p.distanceM);
  const ys = points.map((p) => p.valueMm);
  const at = (arr: readonly number[], i: number): number => arr[i] as number;

  const h: number[] = [];
  const delta: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const step = at(xs, k + 1) - at(xs, k);
    h.push(step);
    delta.push((at(ys, k + 1) - at(ys, k)) / step);
  }

  const tangents: number[] = new Array<number>(n).fill(0);
  if (n === 2) {
    tangents[0] = at(delta, 0);
    tangents[1] = at(delta, 0);
  } else {
    for (let k = 1; k < n - 1; k++) {
      const dPrev = at(delta, k - 1);
      const dNext = at(delta, k);
      if (dPrev * dNext <= 0) {
        tangents[k] = 0;
      } else {
        const w1 = 2 * at(h, k) + at(h, k - 1);
        const w2 = at(h, k) + 2 * at(h, k - 1);
        tangents[k] = (w1 + w2) / (w1 / dPrev + w2 / dNext);
      }
    }
    tangents[0] = endpointTangent(at(h, 0), at(h, 1), at(delta, 0), at(delta, 1));
    tangents[n - 1] = endpointTangent(
      at(h, n - 2),
      at(h, n - 3),
      at(delta, n - 2),
      at(delta, n - 3),
    );
  }

  return (distanceM: number): number => {
    const k = segmentIndex(xs, distanceM);
    const x0 = at(xs, k);
    if (distanceM === x0) return at(ys, k);
    const x1 = at(xs, k + 1);
    if (distanceM === x1) return at(ys, k + 1);

    const width = at(h, k);
    const s = (distanceM - x0) / width;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    return (
      h00 * at(ys, k) +
      h10 * width * at(tangents, k) +
      h01 * at(ys, k + 1) +
      h11 * width * at(tangents, k + 1)
    );
  };
}

/** Three-point endpoint formula, clipped to keep the shape (SciPy `_edge_case`). */
function endpointTangent(h0: number, h1: number, d0: number, d1: number): number {
  const t = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(t) !== Math.sign(d0)) return 0;
  if (Math.sign(d0) !== Math.sign(d1) && Math.abs(t) > 3 * Math.abs(d0)) return 3 * d0;
  return t;
}

/** Index `k` of the segment `[xs[k], xs[k+1]]` that holds `x`, clamped to the valid range. */
function segmentIndex(xs: readonly number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((xs[mid] as number) <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
