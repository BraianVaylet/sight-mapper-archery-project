import type { DecimalSeparator } from '@sight-mapper/domain';
import {
  createArrowSet,
  toValidationIssues,
  type ArrowSet,
  type CreateArrowSet,
  type UpdateArrowSet,
} from '@sight-mapper/schemas';
import type { UnitSystem, ValidationIssue } from '@sight-mapper/types';
import { readQuantity, showQuantity, unitOf } from './units.js';

export { unitOf };

/** Every number the form asks for, with the quantity it measures (UNIDADES §1). */
export const NUMBER_FIELDS = [
  { name: 'spine', quantity: 'rating' },
  { name: 'cutLengthMm', quantity: 'length' },
  { name: 'gpi', quantity: 'rating' },
  { name: 'pointWeightG', quantity: 'mass' },
  { name: 'extraWeightG', quantity: 'mass' },
  { name: 'totalWeightG', quantity: 'mass' },
  { name: 'vaneCount', quantity: 'rating' },
  { name: 'measuredSpeedMps', quantity: 'speed' },
] as const;

export const TEXT_FIELDS = [
  'name',
  'manufacturer',
  'model',
  'vanes',
  'vaneColor',
  'nock',
  'notes',
] as const;

export type NumberFieldName = (typeof NUMBER_FIELDS)[number]['name'];
export type TextFieldName = (typeof TEXT_FIELDS)[number];
export type ArrowFormValues = Record<NumberFieldName | TextFieldName, string>;

export const emptyValues = (): ArrowFormValues => ({
  name: '',
  manufacturer: '',
  model: '',
  vanes: '',
  vaneColor: '',
  nock: '',
  notes: '',
  spine: '',
  cutLengthMm: '',
  gpi: '',
  pointWeightG: '',
  extraWeightG: '',
  totalWeightG: '',
  vaneCount: '',
  measuredSpeedMps: '',
});

/** A stored set (canonical units) as the text the archer sees in their system. */
export function toFormValues(
  set: Partial<ArrowSet> | undefined,
  system: UnitSystem,
  separator: DecimalSeparator,
): ArrowFormValues {
  const values = emptyValues();
  if (set === undefined) return values;
  for (const name of TEXT_FIELDS) values[name] = set[name] ?? '';
  for (const { name, quantity } of NUMBER_FIELDS) {
    const stored = set[name];
    if (stored === undefined || stored === null) continue;
    values[name] = showQuantity(stored, quantity, system, separator);
  }
  return values;
}

export type ArrowFormResult =
  | { ok: true; input: CreateArrowSet; clears: string[] }
  | { ok: false; errors: Partial<Record<string, ValidationIssue>> };

/**
 * The typed values to a set of arrows in canonical units, checked by the schema the API uses.
 * Only the name is needed: a blank number is "did not measure it", sent as `null` on an edit.
 */
export function toArrowSetInput(
  values: ArrowFormValues,
  system: UnitSystem,
  id: string,
): ArrowFormResult {
  const errors: Partial<Record<string, ValidationIssue>> = {};
  const draft: Record<string, unknown> = { id };
  const clears: string[] = [];

  for (const name of TEXT_FIELDS) {
    const text = values[name].trim();
    if (text === '') clears.push(name);
    else draft[name] = text;
  }
  if (values.name.trim() === '') {
    errors['name'] = { path: ['name'], messageKey: 'validation.required', params: {} };
  }

  for (const { name, quantity } of NUMBER_FIELDS) {
    const text = values[name].trim();
    if (text === '') {
      clears.push(name);
      continue;
    }
    const typed = readQuantity(text, quantity, system);
    if (typed === null) {
      errors[name] = { path: [name], messageKey: 'validation.arrow.number', params: {} };
    } else {
      draft[name] = typed;
    }
  }

  const parsed = createArrowSet.safeParse(draft);
  if (!parsed.success) {
    for (const issue of toValidationIssues(parsed.error)) {
      const name = String(issue.path[0] ?? '');
      if (name !== '' && errors[name] === undefined) errors[name] = issue;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!parsed.success) return { ok: false, errors: {} };
  return { ok: true, input: parsed.data, clears: clears.filter((name) => name !== 'name') };
}

/** An edit sends what is filled in and `null` for what was cleared (never for the name). */
export function toArrowSetPatch(result: {
  input: CreateArrowSet;
  clears: readonly string[];
}): UpdateArrowSet {
  const fields = Object.entries(result.input).filter(([name]) => name !== 'id');
  return Object.fromEntries([
    ...fields,
    ...result.clears.map((name) => [name, null]),
  ]) as UpdateArrowSet;
}
