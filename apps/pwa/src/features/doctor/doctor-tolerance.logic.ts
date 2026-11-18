import { DOCTOR_ENDPOINT_FACTOR, type DecimalSeparator } from '@sight-mapper/domain';
import { DOCTOR_TOLERANCE } from '@sight-mapper/schemas';

/** Every tolerance the archer may pick (RN-CAL-06): 1 to 10 mm in steps of 0.5. */
export function toleranceOptions(): number[] {
  const count = (DOCTOR_TOLERANCE.maxMm - DOCTOR_TOLERANCE.minMm) / DOCTOR_TOLERANCE.stepMm;
  return Array.from(
    { length: count + 1 },
    (_, i) => DOCTOR_TOLERANCE.minMm + i * DOCTOR_TOLERANCE.stepMm,
  );
}

/** What the Doctor uses: the archer's own, or the calibrated default when there is none. */
export const effectiveTolerance = (stored: number | null | undefined): number =>
  stored ?? DOCTOR_TOLERANCE.defaultMm;

/**
 * The thresholds of the worked example on the screen, for a sight whose step is 1 mm (never more
 * than the smallest tolerance, so the tolerance is what counts): an interior mark, and the first and
 * last, which are predicted by extrapolation (SIGHT-MATH §8.2).
 */
export function exampleThresholds(toleranceMm: number): { inner: number; ends: number } {
  const quantumMm = 1;
  const base = Math.max(toleranceMm, quantumMm);
  return { inner: base, ends: base * DOCTOR_ENDPOINT_FACTOR };
}

/** Below this the screen warns that good marks get flagged too (SIGHT-MATH §8.3: at 1 mm they do). */
export const lowTolerance = (toleranceMm: number): boolean => toleranceMm < 1.5;

/** A millimetre value as text: up to two decimals, in the separator of the locale. */
export function formatMm(value: number, separator: DecimalSeparator): string {
  const text = String(Number(value.toFixed(2)));
  return separator === ',' ? text.replace('.', ',') : text;
}

/** The same value in inches, for an archer whose sight section is imperial: three decimals. */
export function formatInches(mm: number, separator: DecimalSeparator): string {
  const text = (mm / 25.4).toFixed(3);
  return separator === ',' ? text.replace('.', ',') : text;
}
