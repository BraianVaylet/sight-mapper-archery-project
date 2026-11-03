import {
  CALC_MIN_MARKS_DOCTOR,
  CALC_MIN_MARKS_INTERPOLATE,
  createMarkModel,
  diagnose,
  formatReading,
  fromCanonical,
  mmToReading,
  parseDecimal,
  parseImperial,
  queryDistance,
  readingToMm,
  roundReading,
  scaleBoundsMm,
  toCanonical,
  type CalcErrorCode,
  type DecimalSeparator,
  type DoctorReport,
  type MarkKind,
  type SightScale,
} from '@sight-mapper/domain';
import { formatNumber } from '@sight-mapper/i18n';
import type { Mark, SightRef } from '@sight-mapper/schemas';
import type { Locale } from '@sight-mapper/types';
import type { UnitSystem } from '@sight-mapper/types';

export { CALC_MIN_MARKS_DOCTOR, CALC_MIN_MARKS_INTERPOLATE };

/** The scale of a sight as the domain wants it (`unitSizeMm` is `null` when unknown). */
export const toScale = (sight: Pick<SightRef, 'scale'>): SightScale => ({
  unit: sight.scale.unit,
  unitSizeMm: sight.scale.unitSizeMm ?? null,
  min: sight.scale.min,
  max: sight.scale.max,
  resolution: sight.scale.resolution,
  direction: sight.scale.direction,
});

/** What the archer reads on the sight for a position in mm, rounded to what they can set. */
export const readingOf = (valueMm: number, scale: SightScale): number =>
  roundReading(mmToReading(valueMm, scale), scale);

export const showReading = (valueMm: number, scale: SightScale, separator: DecimalSeparator) =>
  formatReading(readingOf(valueMm, scale), scale, separator);

/** A distance typed in the archer's unit to metres; `null` when it is not a number. */
export function readDistance(text: string, system: UnitSystem): number | null {
  const typed = parseDecimal(text);
  if (typed === null) return null;
  return toCanonical('distance', typed, system === 'metric' ? 'm' : 'yd');
}

/** A reading typed on the sight to a position in mm; `in` scales accept fractions (`3 1/4`). */
export function readReading(text: string, scale: SightScale): number | null {
  const typed = scale.unit === 'in' ? parseImperial(text) : parseDecimal(text);
  return typed === null ? null : readingToMm(typed, scale);
}

/** Metres in the archer's unit, for the table and the readout: `40` m or `43,74` yd. */
export function distanceIn(distanceM: number, system: UnitSystem): number {
  return system === 'metric' ? distanceM : fromCanonical('distance', distanceM, 'yd');
}

/**
 * A distance for the archer, in their unit and with a decimal only when it matters: `20 yd` for
 * 18.288 m, `21,9 yd` for 20 m, `45,5 m`. `unit` is the label (`m` or `yd`) from the catalog.
 */
export function formatDistance(
  distanceM: number,
  system: UnitSystem,
  locale: Locale,
  unit: string,
): string {
  const distance = distanceIn(distanceM, system);
  const whole = Number.isInteger(Number(distance.toFixed(2)));
  return `${formatNumber(distance, locale, whole ? 0 : 1)} ${unit}`;
}

export type Tier = 'none' | 'interpolate' | 'extrapolate';

export type Reading =
  | {
      readonly ok: true;
      readonly distanceM: number;
      readonly kind: MarkKind;
      readonly reading: number;
      readonly lowConfidence: boolean;
      readonly outOfScale: boolean;
    }
  | {
      readonly ok: false;
      readonly distanceM: number;
      readonly code: CalcErrorCode;
      readonly params: Readonly<Record<string, number>>;
    };

export type SightAnalysis = {
  readonly count: number;
  /** How much the marks allow: none below 2, interpolation with 2, extrapolation from 3. */
  readonly tier: Tier;
  readonly doctor: DoctorReport | undefined;
  /** Marks the Doctor points at, by id: the one to shoot again, and the others over threshold. */
  readonly suspectIds: ReadonlySet<string>;
  /** Ids of marks in a pair that moves the wrong way (monotonicity). */
  readonly inconsistentIds: ReadonlySet<string>;
  /** The reading for any distance: the measured one exactly, or an estimate (never persisted). */
  readingAt(distanceM: number): Reading;
};

/**
 * What the app knows from the measured marks of a pair, and nothing it has to store: the model
 * runs again from the marks every time (ADR-001). The measured mark answers exactly.
 */
export function analyse(marks: readonly Mark[], scale: SightScale): SightAnalysis {
  const points = marks.map((m) => ({ distanceM: m.distanceM, valueMm: m.scaleValueMm }));
  const model = createMarkModel(points);
  const bounds = scaleBoundsMm(scale);
  const count = model.points.length;

  const doctor =
    count >= CALC_MIN_MARKS_INTERPOLATE
      ? diagnose(
          marks.map((m) => ({ id: m.id, distanceM: m.distanceM, valueMm: m.scaleValueMm })),
          { direction: scale.direction, quantumMm: readingToMm(scale.resolution, scale) },
        )
      : undefined;

  const suspectIds = new Set<string>();
  if (doctor?.suspect !== undefined) suspectIds.add(doctor.suspect.markId);
  for (const id of doctor?.secondary ?? []) suspectIds.add(id);
  const inconsistentIds = new Set<string>();
  for (const pair of doctor?.monotonicity ?? [])
    pair.markIds.forEach((id) => inconsistentIds.add(id));

  return {
    count,
    tier: count < CALC_MIN_MARKS_INTERPOLATE ? 'none' : count === 2 ? 'interpolate' : 'extrapolate',
    doctor,
    suspectIds,
    inconsistentIds,
    readingAt(distanceM) {
      const row = queryDistance(model, distanceM, bounds);
      if (!row.ok) return { ok: false, distanceM, code: row.code, params: row.params };
      return {
        ok: true,
        distanceM,
        kind: row.kind,
        reading: readingOf(row.scaleValueMm, scale),
        lowConfidence: row.lowConfidence,
        outOfScale: row.outOfScale,
      };
    },
  };
}

/** What the Doctor tool says about itself: ready from five marks, `N/5` before (UX-UI §4.2). */
export const doctorProgress = (count: number) => ({
  ready: count >= CALC_MIN_MARKS_DOCTOR,
  have: Math.min(count, CALC_MIN_MARKS_DOCTOR),
  need: CALC_MIN_MARKS_DOCTOR,
});
