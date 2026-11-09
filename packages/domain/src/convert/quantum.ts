import { DomainError } from '../errors.js';

/** Most decimals a quantum may have; 0.000001 is far finer than any sight. */
const MAX_DECIMALS = 6;

export type DecimalSeparator = '.' | ',';

/** Decimals needed to show multiples of `quantum`: 1 -> 0, 0.5 -> 1, 0.25 -> 2. */
export function decimalsForQuantum(quantum: number): number {
  if (!Number.isFinite(quantum) || quantum <= 0) {
    throw new DomainError('Quantum must be a finite number greater than zero');
  }
  for (let decimals = 0; decimals <= MAX_DECIMALS; decimals++) {
    const scaled = quantum * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9 * Math.max(1, scaled)) return decimals;
  }
  throw new DomainError(`Quantum needs more than ${MAX_DECIMALS} decimals`);
}

/**
 * Value as a count of quanta, in integers: `{ units, scale }` where the rounded value is
 * `units / scale`. Avoids accumulating float error (UNIDADES §4).
 */
function toQuantaUnits(value: number, quantum: number): { units: number; scale: number } {
  if (!Number.isFinite(value)) throw new DomainError('Value must be a finite number');
  const decimals = decimalsForQuantum(quantum);
  const scale = 10 ** decimals;
  const quantumUnits = Math.round(quantum * scale);
  const count = Math.round((Math.abs(value) * scale) / quantumUnits);
  return { units: Math.sign(value) * count * quantumUnits, scale };
}

/** `round(value / q) * q`, exact to the quantum's decimals. */
export function roundToQuantum(value: number, quantum: number): number {
  const { units, scale } = toQuantaUnits(value, quantum);
  return units === 0 ? 0 : units / scale;
}

/** Shows `value` rounded to its quantum, with the decimals the quantum implies. */
export function formatDecimal(
  value: number,
  quantum: number,
  separator: DecimalSeparator = '.',
): string {
  const { units, scale } = toQuantaUnits(value, quantum);
  const decimals = decimalsForQuantum(quantum);
  const magnitude = Math.abs(units);
  const whole = Math.floor(magnitude / scale);
  const sign = units < 0 ? '-' : '';
  if (decimals === 0) return `${sign}${whole}`;
  const fraction = String(magnitude - whole * scale).padStart(decimals, '0');
  return `${sign}${whole}${separator}${fraction}`;
}
