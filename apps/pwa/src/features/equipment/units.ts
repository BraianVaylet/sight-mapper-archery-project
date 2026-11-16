import {
  fromCanonical,
  parseDecimal,
  parseImperial,
  toCanonical,
  type DecimalSeparator,
} from '@sight-mapper/domain';
import type { UnitSystem } from '@sight-mapper/types';

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
