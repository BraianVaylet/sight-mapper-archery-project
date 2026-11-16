import {
  CALC_MIN_MARKS_DOCTOR,
  CALC_MIN_MARKS_INTERPOLATE,
  DOCTOR_ENDPOINT_FACTOR,
  DOCTOR_MIN_ABS_MM,
} from '../constants.js';
import { DomainError } from '../errors.js';
import { fitParabola } from '../model/parabola.js';

export type DoctorMark = {
  readonly id: string;
  readonly distanceM: number;
  readonly valueMm: number;
};

export type DoctorStatus = 'insufficient' | 'ok' | 'suspect' | 'inconsistent';

/** How much of the analysis the number of marks allowed (SIGHT-MATH §4). */
export type DoctorLevel = 'none' | 'monotonicity' | 'full';

export type DoctorReport = {
  readonly status: DoctorStatus;
  readonly level: DoctorLevel;
  /** Leave-one-out residual and threshold of every mark, by distance. Empty below 5 marks. */
  readonly residuals: readonly { markId: string; residualMm: number; thresholdMm: number }[];
  /** The worst candidate, if any: the mark to shoot again. */
  readonly suspect?: { markId: string; residualMm: number; suggestion: 'reshoot' };
  /** Other marks over their threshold, worst first. */
  readonly secondary: readonly string[];
  /** Consecutive marks whose readings move the wrong way (or not at all). */
  readonly monotonicity: readonly { markIds: readonly [string, string] }[];
};

export type DoctorOptions = {
  /** `down`: numbers grow downward, so readings grow with distance. `up`: they shrink. */
  readonly direction: 'down' | 'up';
  /** The smallest step the archer can set, in mm: a residual below it is not an error. */
  readonly quantumMm: number;
};

/**
 * Mark Doctor (SIGHT-MATH §7–8): points at the mark that was probably measured wrong, without
 * ever changing the data. Two checks, each from the number of marks it needs:
 *
 * - **Monotonicity (2+ marks).** More distance means the bow points higher, so the sight goes
 *   down: readings must move one way. A pair that does not is `inconsistent`, on both marks.
 * - **Leave-one-out (5+ marks).** Each mark is compared with the parabola fitted *without it*:
 *   a bad mark pulls a global fit toward itself and hides its own residual. A residual beyond
 *   an absolute tolerance (4 mm, never under one quantum) makes it a candidate; the endpoints,
 *   predicted by extrapolation, get more tolerance.
 *
 * Marks need unique distances (RN-MRK-04); anything else is a caller bug (`DomainError`).
 */
export function diagnose(marks: readonly DoctorMark[], options: DoctorOptions): DoctorReport {
  validate(marks, options);
  const sorted = [...marks].sort((a, b) => a.distanceM - b.distanceM);

  if (sorted.length < CALC_MIN_MARKS_INTERPOLATE) {
    return {
      status: 'insufficient',
      level: 'none',
      residuals: [],
      secondary: [],
      monotonicity: [],
    };
  }

  const monotonicity = findMonotonicityBreaks(sorted, options.direction);
  const full = sorted.length >= CALC_MIN_MARKS_DOCTOR;
  const outliers = full ? leaveOneOut(sorted, options.quantumMm) : null;

  const base = {
    level: full ? ('full' as const) : ('monotonicity' as const),
    residuals: outliers?.residuals ?? [],
    secondary: outliers?.secondary ?? [],
    monotonicity,
  };
  const suspect = outliers?.suspect;

  // A broken direction outranks a statistical suspicion: it is certain, the other is not.
  if (monotonicity.length > 0) {
    return { ...base, status: 'inconsistent', ...(suspect === undefined ? {} : { suspect }) };
  }
  if (suspect !== undefined) return { ...base, status: 'suspect', suspect };
  return { ...base, status: 'ok' };
}

function validate(marks: readonly DoctorMark[], options: DoctorOptions): void {
  if (!Number.isFinite(options.quantumMm) || options.quantumMm <= 0) {
    throw new DomainError('quantumMm must be a finite number greater than zero');
  }
  const distances = new Set<number>();
  const ids = new Set<string>();
  for (const mark of marks) {
    if (!Number.isFinite(mark.distanceM) || !Number.isFinite(mark.valueMm) || mark.distanceM <= 0) {
      throw new DomainError('Marks need a positive finite distance and a finite value');
    }
    if (distances.has(mark.distanceM)) throw new DomainError('Marks must have unique distances');
    if (ids.has(mark.id)) throw new DomainError('Marks must have unique ids');
    distances.add(mark.distanceM);
    ids.add(mark.id);
  }
}

function findMonotonicityBreaks(sorted: readonly DoctorMark[], direction: 'down' | 'up') {
  const expected = direction === 'down' ? 1 : -1;
  const breaks: { markIds: readonly [string, string] }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i] as DoctorMark;
    const b = sorted[i + 1] as DoctorMark;
    if (Math.sign(b.valueMm - a.valueMm) !== expected) breaks.push({ markIds: [a.id, b.id] });
  }
  return breaks;
}

function leaveOneOut(sorted: readonly DoctorMark[], quantumMm: number) {
  const residualsMm = sorted.map((mark, i) => {
    const others = sorted.filter((_, j) => j !== i);
    return mark.valueMm - fitParabola(others).evaluate(mark.distanceM);
  });

  // An absolute tolerance, not one estimated from these residuals: with five marks a bad one drags
  // the other four fits toward itself, inflates any such estimate and hides itself (SIGHT-MATH §8.3).
  const base = Math.max(DOCTOR_MIN_ABS_MM, quantumMm);
  const last = sorted.length - 1;

  const residuals = sorted.map((mark, i) => ({
    markId: mark.id,
    residualMm: residualsMm[i] as number,
    thresholdMm: base * (i === 0 || i === last ? DOCTOR_ENDPOINT_FACTOR : 1),
  }));

  // How far over its own threshold each mark is: 1 means exactly on it.
  const candidates = residuals
    .map((r) => ({ ...r, ratio: Math.abs(r.residualMm) / r.thresholdMm }))
    .filter((r) => r.ratio >= 1)
    .sort((a, b) => b.ratio - a.ratio);

  const [worst, ...rest] = candidates;
  return {
    residuals,
    secondary: rest.map((r) => r.markId),
    ...(worst === undefined
      ? {}
      : {
          suspect: {
            markId: worst.markId,
            residualMm: worst.residualMm,
            suggestion: 'reshoot' as const,
          },
        }),
  };
}
