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
type NumberField = (typeof NUMBER_FIELDS)[number];

/** One scale block of the form, as typed: the vertical one, or the horizontal one (F1-42). */
export type ScaleFormValues = Record<NumberField, string> & { unit: string; direction: string };

/** The vertical scale lives flat on the form; the horizontal one in its own block. */
export type SightFormValues = Record<(typeof TEXT_FIELDS)[number], string> &
  ScaleFormValues & {
    pinType: string;
    windage: ScaleFormValues;
  };

/** `mm`, `cm` and `in` have a fixed size; `click` and `custom` take the one the archer knows. */
export const hasFixedSize = (unit: string): boolean =>
  unit === 'mm' || unit === 'cm' || unit === 'in';

/** The scale unit a new sight starts on, from the sight section of the units (RF-ACC-04). */
export type NewScaleUnit = 'mm' | 'in';

const emptyScale = (unit: string, direction: string): ScaleFormValues => ({
  unit,
  direction,
  min: '',
  max: '',
  resolution: '',
  unitSizeMm: '',
  lengthMm: '',
});

export const emptyValues = (unit: NewScaleUnit = 'mm'): SightFormValues => ({
  nickname: '',
  manufacturer: '',
  model: '',
  notes: '',
  pinType: 'monopin',
  ...emptyScale(unit, 'down'),
  windage: emptyScale(unit, 'right'),
});

const verticalOf = (values: SightFormValues): ScaleFormValues => ({
  unit: values.unit,
  direction: values.direction,
  min: values.min,
  max: values.max,
  resolution: values.resolution,
  unitSizeMm: values.unitSizeMm,
  lengthMm: values.lengthMm,
});

/**
 * The horizontal block as a copy of the vertical one, growing right: most sights are graduated
 * the same on both axes, so a new sight starts there and the archer confirms or corrects it.
 */
export const withWindageCopy = (values: SightFormValues): SightFormValues => ({
  ...values,
  windage: { ...verticalOf(values), direction: 'right' },
});

const show = (value: number | null | undefined, separator: DecimalSeparator): string => {
  if (value === null || value === undefined) return '';
  const text = String(Number(value.toFixed(4)));
  return separator === ',' ? text.replace('.', ',') : text;
};

const scaleToForm = (
  scale: NonNullable<Sight['scale'] | Sight['windageScale']>,
  separator: DecimalSeparator,
): ScaleFormValues => ({
  unit: scale.unit,
  direction: scale.direction,
  min: show(scale.min, separator),
  max: show(scale.max, separator),
  resolution: show(scale.resolution, separator),
  unitSizeMm: hasFixedSize(scale.unit) ? '' : show(scale.unitSizeMm, separator),
  lengthMm: '',
});

export function toFormValues(
  sight: Partial<Sight> | undefined,
  separator: DecimalSeparator,
  newUnit: NewScaleUnit = 'mm',
): SightFormValues {
  const values = emptyValues(newUnit);
  if (sight === undefined) return values;
  for (const name of TEXT_FIELDS) values[name] = sight[name] ?? '';
  values.pinType = sight.pinType ?? values.pinType;
  if (sight.scale !== undefined) Object.assign(values, scaleToForm(sight.scale, separator));
  values.windage =
    sight.windageScale == null
      ? emptyScale(values.unit, 'right')
      : scaleToForm(sight.windageScale, separator);
  return values;
}

const NOT_A_NUMBER = (path: string): ValidationIssue => ({
  path: [path],
  messageKey: 'validation.sight.number',
  params: {},
});
const REQUIRED = (path: string): ValidationIssue => ({
  path: [path],
  messageKey: 'validation.required',
  params: {},
});

type Parsed = { value: number | undefined; bad: boolean };
function number(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { value: undefined, bad: false };
  const value = parseDecimal(trimmed);
  return value === null ? { value: undefined, bad: true } : { value, bad: false };
}

type Errors = Partial<Record<string, ValidationIssue>>;

/**
 * One scale block to the shape the schema checks. For `custom` and `click` the archer may give
 * the size of one unit, or the physical length between min and max (HU-SGT-01): the size is then
 * `length / (max - min)`. Errors land on `<prefix><field>`.
 */
function readScale(block: ScaleFormValues, errors: Errors, prefix: string) {
  const read = (name: NumberField) => {
    const parsed = number(block[name]);
    if (parsed.bad) errors[prefix + name] = NOT_A_NUMBER(prefix + name);
    return parsed.value;
  };
  const min = read('min');
  const max = read('max');
  const resolution = read('resolution');
  const size = hasFixedSize(block.unit) ? undefined : read('unitSizeMm');
  const length = hasFixedSize(block.unit) ? undefined : read('lengthMm');

  let unitSize = size;
  if (unitSize === undefined && length !== undefined && min !== undefined && max !== undefined) {
    if (max > min && length > 0) unitSize = unitSizeFromLength(length, min, max);
  }
  return {
    unit: block.unit,
    direction: block.direction,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(resolution === undefined ? {} : { resolution }),
    ...(unitSize === undefined ? {} : { unitSizeMm: unitSize }),
  };
}

const isBlank = (block: ScaleFormValues) =>
  NUMBER_FIELDS.every((name) => block[name].trim() === '');

export type SightFormResult =
  { ok: true; input: CreateSight; clears: string[] } | { ok: false; errors: Errors };

export type SightFormOptions = {
  /** A new sight must bring its horizontal scale; an older one may stay without it (F1-42). */
  requireWindage?: boolean;
};

/** The typed values to a sight, checked by the schema the API uses. */
export function toSightInput(
  values: SightFormValues,
  id: string,
  options: SightFormOptions = {},
): SightFormResult {
  const errors: Errors = {};
  const windageBlank = isBlank(values.windage);
  if (windageBlank && options.requireWindage === true) {
    for (const name of ['min', 'max', 'resolution'] as const) {
      errors[`windage.${name}`] = REQUIRED(`windage.${name}`);
    }
  }

  const draft: Record<string, unknown> = {
    id,
    pinType: values.pinType,
    scale: readScale(verticalOf(values), errors, ''),
    ...(windageBlank ? {} : { windageScale: readScale(values.windage, errors, 'windage.') }),
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
      // `scale.max` is the field `max` on this form; `windageScale.max` is `windage.max`.
      const field = String(issue.path[issue.path.length - 1] ?? '');
      const name = issue.path[0] === 'windageScale' ? `windage.${field}` : field;
      if (field !== '' && errors[name] === undefined) errors[name] = issue;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!parsed.success) return { ok: false, errors: {} };
  return { ok: true, input: parsed.data, clears };
}

/**
 * An edit sends everything the form holds: what is filled in, and `null` for what was cleared.
 * A horizontal scale the archer has not loaded yet is left out: the API never takes it back to null.
 */
export function toSightPatch(result: {
  input: CreateSight;
  clears: readonly string[];
}): UpdateSight {
  const fields = Object.entries(result.input).filter(
    ([name, value]) => name !== 'id' && !(name === 'windageScale' && value === null),
  );
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
    { ...values, nickname: '', manufacturer: '', model: 'x', windage: emptyScale('mm', 'right') },
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
  const result = toSightInput(
    { ...values, model: values.model || 'x', windage: emptyScale('mm', 'right') },
    PLACEHOLDER_ID,
  );
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
