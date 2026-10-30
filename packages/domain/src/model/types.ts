import type { CalcFailure } from '../errors.js';

/** A measured mark in canonical units: metres and millimetres of scale (ADR-005). */
export type MarkPoint = {
  readonly distanceM: number;
  readonly valueMm: number;
};

export type MarkKind = 'measured' | 'interpolated' | 'extrapolated';

export type CalcSuccess = {
  readonly ok: true;
  readonly valueMm: number;
  readonly kind: MarkKind;
  readonly lowConfidence: boolean;
};

export type CalcResult = CalcSuccess | CalcFailure;

export type MarkModel = {
  /** Measured marks after preprocessing: sorted, unique distances. */
  readonly points: readonly MarkPoint[];
  markAt(distanceM: number): CalcResult;
};
