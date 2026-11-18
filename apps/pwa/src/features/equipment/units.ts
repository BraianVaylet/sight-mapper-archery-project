import {
  fromCanonical,
  parseDecimal,
  parseImperial,
  toCanonical,
  type DecimalSeparator,
} from '@sight-mapper/domain';
import type { UnitSystem, ValidationIssue } from '@sight-mapper/types';

/**
 * What a number on an equipment form measures (UNIDADES §1). `percent` and `rating` (spine, GPI)
 * are the same in both systems and are never converted.
 */
export type Quantity = 'length' | 'force' | 'speed' | 'mass' | 'percent' | 'rating';

/** What the archer types in, per system: mm / kg / m/s / g, or in / lb / fps / gr. */
export function unitOf(quantity: Quantity, system: UnitSystem): string {
  const metric = system === 'metric';
  switch (quantity) {
    case 'length':
      return metric ? 'mm' : 'in';
    case 'force':
      return metric ? 'kg' : 'lb';
    case 'speed':
      return metric ? 'm/s' : 'fps';
    case 'mass':
      return metric ? 'g' : 'gr';
    case 'percent':
      return '%';
    case 'rating':
      return '';
  }
}

/** The unit tokens of the domain converter for each quantity and system. */
function converter(quantity: Quantity, system: UnitSystem) {
  const metric = system === 'metric';
  switch (quantity) {
    case 'length':
      return { quantity: 'length', unit: metric ? 'mm' : 'in' } as const;
    case 'force':
      return { quantity: 'force', unit: metric ? 'kg' : 'lb' } as const;
    case 'speed':
      return { quantity: 'speed', unit: metric ? 'mps' : 'fps' } as const;
    case 'mass':
      return { quantity: 'mass', unit: metric ? 'g' : 'gr' } as const;
    case 'percent':
    case 'rating':
      return null;
  }
}

/** Two decimals at most: enough for 6.25 in or 62.5 lb, and no 0.30000000000000004. */
function display(value: number, separator: DecimalSeparator): string {
  const text = String(Number(value.toFixed(2)));
  return separator === ',' ? text.replace('.', ',') : text;
}

/** A stored canonical value as the text the archer sees in their system. */
export function showQuantity(
  stored: number,
  quantity: Quantity,
  system: UnitSystem,
  separator: DecimalSeparator,
): string {
  const convert = converter(quantity, system);
  return display(
    convert === null ? stored : fromCanonical(convert.quantity, stored, convert.unit as never),
    separator,
  );
}

/**
 * What the archer typed, in canonical units; `null` when it is not a number. Fractions are
 * accepted only for imperial lengths (`6 1/4`).
 */
export function readQuantity(text: string, quantity: Quantity, system: UnitSystem): number | null {
  const fractions = system === 'imperial' && quantity === 'length';
  const typed = fractions ? parseImperial(text) : parseDecimal(text);
  if (typed === null) return null;
  const convert = converter(quantity, system);
  return convert === null ? typed : toCanonical(convert.quantity, typed, convert.unit as never);
}

/** Decimals a range is shown with (DICCIONARIO §3): in, lb and kg to one; the rest whole. */
function rangeDecimals(quantity: Quantity, system: UnitSystem): number {
  if (system === 'imperial') return quantity === 'length' || quantity === 'force' ? 1 : 0;
  return quantity === 'force' ? 1 : 0;
}

/**
 * A canonical `[min, max]` as the archer reads it in their system (RN-EQP-03): `148–442`. Rounded
 * inward, the minimum up and the maximum down, so the range shown never holds a value the schema
 * refuses. The tiny tolerance keeps an exact bound (300 mm) from being pushed by float noise.
 */
export function showRange(
  [min, max]: readonly [number, number],
  quantity: Quantity,
  system: UnitSystem,
  separator: DecimalSeparator,
): string {
  const convert = converter(quantity, system);
  const shown = (value: number) =>
    convert === null ? value : fromCanonical(convert.quantity, value, convert.unit as never);
  const factor = 10 ** rangeDecimals(quantity, system);
  const low = Math.ceil(shown(min) * factor - 1e-9) / factor;
  const high = Math.floor(shown(max) * factor + 1e-9) / factor;
  return `${display(low, separator)}–${display(high, separator)}`;
}

/** What the hint and the error of a number field say about its range: `148–442` and `fps`. */
export function rangeParams(
  range: readonly [number, number],
  quantity: Quantity,
  system: UnitSystem,
  separator: DecimalSeparator,
): { range: string; unit: string } {
  return { range: showRange(range, quantity, system, separator), unit: unitOf(quantity, system) };
}

/**
 * A minimum or maximum the schema refused becomes "out of range": the screen fills in the range in
 * the archer's unit (`rangeParams`), never the canonical bound (newtons, grams) Zod knows.
 */
export function asRangeIssue(issue: ValidationIssue): ValidationIssue {
  if (issue.messageKey !== 'validation.too_small' && issue.messageKey !== 'validation.too_big') {
    return issue;
  }
  return { path: issue.path, messageKey: 'validation.equipment.outOfRange', params: {} };
}
