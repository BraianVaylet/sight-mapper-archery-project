import {
  hasPhysicalScale,
  parseDecimal,
  unitSizeFromLength,
  unitSizeMm,
  type DecimalSeparator,
  type SightScale,
} from '@sight-mapper/domain';
import {
  createSight,
  toValidationIssues,
  type CreateSight,
  type Sight,
  type UpdateSight,
} from '@sight-mapper/schemas';
import type { ValidationIssue } from '@sight-mapper/types';

/** A valid id for checks that only look at the scale: nothing is saved with it. */
const PLACEHOLDER_ID = '01927e5a-0000-7000-8000-000000000000';

export const TEXT_FIELDS = ['nickname', 'manufacturer', 'model', 'notes'] as const;
export const NUMBER_FIELDS = ['min', 'max', 'resolution', 'unitSizeMm', 'lengthMm'] as const;

export type SightFormValues = Record<(typeof TEXT_FIELDS)[number], string> &
  Record<(typeof NUMBER_FIELDS)[number], string> & {
    pinType: string;
    unit: string;
    direction: string;
  };

/** `mm`, `cm` and `in` have a fixed size; `click` and `custom` take the one the archer knows. */
export const hasFixedSize = (unit: string): boolean =>
  unit === 'mm' || unit === 'cm' || unit === 'in';

export const emptyValues = (): SightFormValues => ({
  nickname: '',
  manufacturer: '',
  model: '',
  notes: '',
  pinType: 'monopin',
  unit: 'cm',
  direction: 'down',
  min: '',
  max: '',
  resolution: '',
  unitSizeMm: '',
  lengthMm: '',
});

const show = (value: number | null | undefined, separator: DecimalSeparator): string => {
  if (value === null || value === undefined) return '';
  const text = String(Number(value.toFixed(4)));
  return separator === ',' ? text.replace('.', ',') : text;
};

export function toFormValues(
  sight: Partial<Sight> | undefined,
  separator: DecimalSeparator,
): SightFormValues {
  const values = emptyValues();
  if (sight === undefined) return values;
  for (const name of TEXT_FIELDS) values[name] = sight[name] ?? '';
  values.pinType = sight.pinType ?? values.pinType;
  if (sight.scale !== undefined) {
    values.unit = sight.scale.unit;
    values.direction = sight.scale.direction;
    values.min = show(sight.scale.min, separator);
    values.max = show(sight.scale.max, separator);
    values.resolution = show(sight.scale.resolution, separator);
    values.unitSizeMm = hasFixedSize(sight.scale.unit)
      ? ''
      : show(sight.scale.unitSizeMm, separator);
  }
  return values;
}

const NOT_A_NUMBER = (name: string): ValidationIssue => ({
  path: [name],
  messageKey: 'validation.sight.number',
  params: {},
});

type Parsed = { value: number | undefined; bad: boolean };
function number(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { value: undefined, bad: false };
  const value = parseDecimal(trimmed);
  return value === null ? { value: undefined, bad: true } : { value, bad: false };
}

export type SightFormResult =
  | { ok: true; input: CreateSight; clears: string[] }
  | { ok: false; errors: Partial<Record<string, ValidationIssue>> };

/**
 * The typed values to a sight, checked by the schema the API uses. For `custom` and `click` the
 * archer may give the size of one unit, or the physical length between min and max (HU-SGT-01):
 * the size is then `length / (max - min)`.
 */
export function toSightInput(values: SightFormValues, id: string): SightFormResult {
  const errors: Partial<Record<string, ValidationIssue>> = {};
  const read = (name: (typeof NUMBER_FIELDS)[number]) => {
    const parsed = number(values[name]);
    if (parsed.bad) errors[name] = NOT_A_NUMBER(name);
    return parsed.value;
  };
  const min = read('min');
  const max = read('max');
  const resolution = read('resolution');
  const size = hasFixedSize(values.unit) ? undefined : read('unitSizeMm');
  const length = hasFixedSize(values.unit) ? undefined : read('lengthMm');

  let unitSize = size;
  if (unitSize === undefined && length !== undefined && min !== undefined && max !== undefined) {
    if (max > min && length > 0) unitSize = unitSizeFromLength(length, min, max);
  }

  const draft: Record<string, unknown> = {
    id,
    pinType: values.pinType,
    scale: {
      unit: values.unit,
      direction: values.direction,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
      ...(resolution === undefined ? {} : { resolution }),
      ...(unitSize === undefined ? {} : { unitSizeMm: unitSize }),
    },
  };
  const clears: string[] = [];
  for (const name of TEXT_FIELDS) {
    const text = values[name].trim();
    if (text === '') clears.push(name);
    else draft[name] = text;
  }

  const parsed = createSight.safeParse(draft);
  if (!parsed.success) {
    for (const issue of toValidationIssues(parsed.error)) {
      // `scale.max` is the field `max` on this form.
      const name = String(issue.path[issue.path.length - 1] ?? '');
      if (name !== '' && errors[name] === undefined) errors[name] = issue;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!parsed.success) return { ok: false, errors: {} };
  return { ok: true, input: parsed.data, clears };
}

/** An edit sends everything the form holds: what is filled in, and `null` for what was cleared. */
export function toSightPatch(result: {
  input: CreateSight;
  clears: readonly string[];
}): UpdateSight {
  const fields = Object.entries(result.input).filter(([name]) => name !== 'id');
  return Object.fromEntries([
    ...fields,
    ...result.clears.map((name) => [name, null]),
  ]) as UpdateSight;
}

/** The whole travel of the scale in mm ("Recorrido: 80 mm"), when the numbers allow it. */
export function travelMm(values: SightFormValues): number | undefined {
  const min = number(values.min).value;
  const max = number(values.max).value;
  if (min === undefined || max === undefined || max <= min) return undefined;
  const result = toSightInput(
    { ...values, nickname: '', manufacturer: '', model: 'x' },
    PLACEHOLDER_ID,
  );
  if (!result.ok) return undefined;
  const scale = result.input.scale;
  if (!hasPhysicalScale({ unit: scale.unit, unitSizeMm: scale.unitSizeMm ?? null })) {
    return undefined;
  }
  return (max - min) * unitSizeMm({ unit: scale.unit, unitSizeMm: scale.unitSizeMm ?? null });
}

/** The scale the ruler preview draws, when the numbers make a valid one. */
export function previewScale(values: SightFormValues): SightScale | undefined {
  const result = toSightInput({ ...values, model: values.model || 'x' }, PLACEHOLDER_ID);
  if (!result.ok) return undefined;
  const scale = result.input.scale;
  return {
    unit: scale.unit,
    unitSizeMm: scale.unitSizeMm ?? null,
    min: scale.min,
    max: scale.max,
    resolution: scale.resolution,
    direction: scale.direction,
  };
}
