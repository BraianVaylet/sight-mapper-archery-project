import type { DecimalSeparator } from '@sight-mapper/domain';
import { readQuantity, showQuantity, unitOf } from './units.js';
import {
  createBow,
  toValidationIssues,
  type Bow,
  type CreateBow,
  type UpdateBow,
} from '@sight-mapper/schemas';
import type { UnitSystem, ValidationIssue } from '@sight-mapper/types';

/** Every number the form asks for, with the quantity it measures (UNIDADES §1). */
export const NUMBER_FIELDS = [
  { name: 'iboSpeedMps', quantity: 'speed' },
  { name: 'letOffPct', quantity: 'percent' },
  { name: 'drawLengthMm', quantity: 'length' },
  { name: 'drawWeightN', quantity: 'force' },
  { name: 'axleToAxleMm', quantity: 'length' },
  { name: 'braceHeightMm', quantity: 'length' },
  { name: 'sightRadiusMm', quantity: 'length' },
  { name: 'peepHeightMm', quantity: 'length' },
  { name: 'dLoopLengthMm', quantity: 'length' },
] as const;

export const TEXT_FIELDS = ['nickname', 'manufacturer', 'model', 'rest', 'notes'] as const;

export type NumberFieldName = (typeof NUMBER_FIELDS)[number]['name'];
export type TextFieldName = (typeof TEXT_FIELDS)[number];
export type BowFormValues = Record<NumberFieldName | TextFieldName | 'camType', string>;

export { unitOf };

export const emptyValues = (): BowFormValues => ({
  nickname: '',
  manufacturer: '',
  model: '',
  rest: '',
  notes: '',
  camType: '',
  iboSpeedMps: '',
  letOffPct: '',
  drawLengthMm: '',
  drawWeightN: '',
  axleToAxleMm: '',
  braceHeightMm: '',
  sightRadiusMm: '',
  peepHeightMm: '',
  dLoopLengthMm: '',
});

/** A stored bow (canonical units) as the text the archer sees in their system. */
export function toFormValues(
  bow: Partial<Bow> | undefined,
  system: UnitSystem,
  separator: DecimalSeparator,
): BowFormValues {
  const values = emptyValues();
  if (bow === undefined) return values;
  for (const name of TEXT_FIELDS) values[name] = bow[name] ?? '';
  values.camType = bow.camType ?? '';
  for (const { name, quantity } of NUMBER_FIELDS) {
    const stored = bow[name];
    if (stored === undefined || stored === null) continue;
    values[name] = showQuantity(stored, quantity, system, separator);
  }
  return values;
}

const NOT_A_NUMBER: ValidationIssue = {
  path: [],
  messageKey: 'validation.bow.number',
  params: {},
};

export type BowFormResult =
  | { ok: true; input: CreateBow; clears: string[] }
  | { ok: false; errors: Partial<Record<string, ValidationIssue>> };

/**
 * The typed values to a bow in canonical units, checked by the same schema the API uses. Fractions
 * are accepted in imperial lengths (`6 1/4`). `clears` lists the fields left blank, so an edit can
 * send `null` for them.
 */
export function toBowInput(values: BowFormValues, system: UnitSystem, id: string): BowFormResult {
  const errors: Partial<Record<string, ValidationIssue>> = {};
  const draft: Record<string, unknown> = { id, bowType: 'compound' };
  const clears: string[] = [];

  for (const name of TEXT_FIELDS) {
    const text = values[name].trim();
    if (text === '') clears.push(name);
    else draft[name] = text;
  }
  if (values.camType === '') clears.push('camType');
  else draft['camType'] = values.camType;

  for (const { name, quantity } of NUMBER_FIELDS) {
    const text = values[name].trim();
    if (text === '') {
      clears.push(name);
      continue;
    }
    const typed = readQuantity(text, quantity, system);
    if (typed === null) {
      errors[name] = { ...NOT_A_NUMBER, path: [name] };
      continue;
    }
    draft[name] = typed;
  }

  const parsed = createBow.safeParse(draft);
  if (!parsed.success) {
    for (const issue of toValidationIssues(parsed.error)) {
      const name = String(issue.path[0] ?? '');
      if (name !== '' && errors[name] === undefined) errors[name] = issue;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!parsed.success) return { ok: false, errors: {} };
  return { ok: true, input: parsed.data, clears };
}

/** An edit sends everything the form holds: what is filled in, and `null` for what was cleared. */
export function toBowPatch(result: { input: CreateBow; clears: readonly string[] }): UpdateBow {
  const fields = Object.entries(result.input).filter(([name]) => name !== 'id');
  return Object.fromEntries([...fields, ...result.clears.map((name) => [name, null])]) as UpdateBow;
}
