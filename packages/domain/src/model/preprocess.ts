import { DomainError } from '../errors.js';
import type { MarkPoint } from './types.js';

/**
 * Sorts by distance and collapses repeated distances by averaging the position (SIGHT-MATH §3).
 * Callers pass only measured, non-deleted marks of one (setup, arrow set) pair.
 */
export function preprocess(marks: readonly MarkPoint[]): MarkPoint[] {
  for (const mark of marks) {
    if (!Number.isFinite(mark.distanceM) || !Number.isFinite(mark.valueMm)) {
      throw new DomainError('Mark values must be finite numbers');
    }
    if (mark.distanceM <= 0) {
      throw new DomainError('Mark distance must be greater than zero');
    }
  }

  const sorted = [...marks].sort((a, b) => a.distanceM - b.distanceM);
  const out: MarkPoint[] = [];
  let group: MarkPoint[] = [];

  const flush = (): void => {
    const first = group[0];
    if (first === undefined) return;
    const sum = group.reduce((acc, m) => acc + m.valueMm, 0);
    out.push({ distanceM: first.distanceM, valueMm: sum / group.length });
    group = [];
  };

  for (const mark of sorted) {
    if (group.length > 0 && group[0]?.distanceM !== mark.distanceM) flush();
    group.push(mark);
  }
  flush();
  return out;
}
