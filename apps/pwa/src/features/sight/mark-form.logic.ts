import {
  decimalsForQuantum,
  formatDecimal,
  roundToQuantum,
  scaleBoundsMm,
  type DecimalSeparator,
  type SightScale,
} from '@sight-mapper/domain';
import { fromLocalInput, toLocalInput } from '../../app/device-time.js';
import { createMark, type CreateMark, type Mark } from '@sight-mapper/schemas';
import type { UnitSystem } from '@sight-mapper/types';
import { distanceIn, readDistance, readReading, readingOf, showReading } from './sight.logic.js';

/** The farthest an archer can shoot (RN-MRK-01), in metres. */
export const MAX_DISTANCE_M = 300;
const NOTE_MAX = 200;

export { fromLocalInput, toLocalInput };

export type MarkFormValues = {
  distance: string;
  reading: string;
  note: string;
  /** `datetime-local`: `2026-11-03T09:30`, in the device's zone. Empty means "now". */
  measuredAt: string;
};

export type FieldError = { messageKey: string; params: Record<string, string | number> };
export type MarkFormErrors = Partial<Record<'distance' | 'reading' | 'note', FieldError>>;

export type MarkFormContext = {
  system: UnitSystem;
  scale: SightScale;
  separator: DecimalSeparator;
  /** `m` or `yd`, for the error that names a limit. */
  distanceUnit: string;
};

const text = (value: number, decimals: number, separator: DecimalSeparator) => {
  const shown = String(Number(value.toFixed(decimals)));
  return separator === ',' ? shown.replace('.', ',') : shown;
};

/** What the sheet shows when it opens: empty for a new mark, the saved one for an edit. */
export function toFormValues(
  mark: Mark | undefined,
  context: Pick<MarkFormContext, 'system' | 'scale' | 'separator'>,
): MarkFormValues {
  if (mark === undefined) return { distance: '', reading: '', note: '', measuredAt: '' };
  return {
    distance: text(distanceIn(mark.distanceM, context.system), 2, context.separator),
    reading: showReading(mark.scaleValueMm, context.scale, context.separator),
    note: mark.note ?? '',
    measuredAt: toLocalInput(mark.measuredAt),
  };
}

export type MarkFormResult =
  { ok: true; input: CreateMark } | { ok: false; errors: MarkFormErrors };

const required: FieldError = { messageKey: 'validation.required', params: {} };
const notANumber: FieldError = { messageKey: 'mark.errors.number', params: {} };

/**
 * The typed values to a mark in canonical units (metres and millimetres), checked here with the
 * rules the API enforces so the archer is told at once: the distance (0, 300] m, the reading on
 * the scale of the sight, the note length.
 */
export function toMarkInput(
  values: MarkFormValues,
  ids: { id: string; setupId: string; arrowSetId: string; replace?: boolean },
  context: MarkFormContext,
): MarkFormResult {
  const errors: MarkFormErrors = {};

  let distanceM: number | undefined;
  if (values.distance.trim() === '') errors.distance = required;
  else {
    const metres = readDistance(values.distance, context.system);
    if (metres === null) errors.distance = notANumber;
    else if (metres <= 0 || metres > MAX_DISTANCE_M) {
      const max = text(distanceIn(MAX_DISTANCE_M, context.system), 0, context.separator);
      errors.distance = {
        messageKey: 'mark.errors.distanceRange',
        params: { max: `${max} ${context.distanceUnit}` },
      };
    } else distanceM = metres;
  }

  let scaleValueMm: number | undefined;
  if (values.reading.trim() === '') errors.reading = required;
  else {
    const position = readReading(values.reading, context.scale);
    if (position === null) errors.reading = notANumber;
    else {
      const { minMm, maxMm } = scaleBoundsMm(context.scale);
      if (position < minMm || position > maxMm) {
        errors.reading = {
          messageKey: 'mark.errors.outOfScale',
          params: {
            min: showReading(minMm, context.scale, context.separator),
            max: showReading(maxMm, context.scale, context.separator),
          },
        };
      } else scaleValueMm = position;
    }
  }

  if (values.note.trim().length > NOTE_MAX) {
    errors.note = { messageKey: 'mark.errors.noteTooLong', params: {} };
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const note = values.note.trim();
  const measuredAt = fromLocalInput(values.measuredAt);
  const parsed = createMark.safeParse({
    id: ids.id,
    setupId: ids.setupId,
    arrowSetId: ids.arrowSetId,
    distanceM,
    scaleValueMm,
    replace: ids.replace ?? false,
    ...(note === '' ? {} : { note }),
    ...(measuredAt === undefined ? {} : { measuredAt }),
  });
  // The checks above are the schema's own: reaching here with a failure is a bug, not a typo.
  if (!parsed.success) return { ok: false, errors: { distance: notANumber } };
  return { ok: true, input: parsed.data };
}

/**
 * The stepper of the reading: one resolution up or down, clamped to the scale. An empty or
 * unreadable field starts from the end the scale starts at.
 */
export function stepReading(
  current: string,
  direction: 1 | -1,
  context: Pick<MarkFormContext, 'scale' | 'separator'>,
): string {
  const { scale, separator } = context;
  const position = readReading(current, scale);
  const reading = position === null ? scale.min : readingOf(position, scale);
  const next = roundToQuantum(reading + direction * scale.resolution, scale.resolution);
  const clamped = Math.min(scale.max, Math.max(scale.min, next));
  return formatDecimal(clamped, scale.resolution, separator);
}

/** The stepper of the distance: one metre or yard, never below one. */
export function stepDistance(
  current: string,
  direction: 1 | -1,
  context: Pick<MarkFormContext, 'system' | 'separator'>,
): string {
  const metres = readDistance(current, context.system);
  const shown = metres === null ? 0 : distanceIn(metres, context.system);
  const next = Math.max(1, Math.round(shown) + direction);
  return text(next, 0, context.separator);
}

/** Decimals the reading is shown with, for the field's `inputMode` hint. */
export const readingDecimals = (scale: SightScale) => decimalsForQuantum(scale.resolution);
