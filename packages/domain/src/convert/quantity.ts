import { DomainError } from '../errors.js';
import {
  DISTANCE_QUANTUM_M,
  G_PER_GR,
  MM_PER_IN,
  MPS_PER_FPS,
  M_PER_YD,
  N_PER_KGF,
  N_PER_LBF,
} from './constants.js';

/** Canonical unit of each quantity: m, mm, g, m/s, N (ADR-005). */
const FACTORS = {
  distance: { m: 1, yd: M_PER_YD },
  length: { mm: 1, cm: 10, in: MM_PER_IN },
  mass: { g: 1, gr: G_PER_GR },
  speed: { mps: 1, fps: MPS_PER_FPS },
  force: { N: 1, kg: N_PER_KGF, lb: N_PER_LBF },
} as const;

export type Quantity = keyof typeof FACTORS;
export type UnitOf<Q extends Quantity> = keyof (typeof FACTORS)[Q] & string;

/** Strips float noise (0.1 * 3) without changing any value an archer could type. */
export function tidy(value: number): number {
  return Number(value.toPrecision(12));
}

function factor<Q extends Quantity>(quantity: Q, unit: UnitOf<Q>): number {
  const table: Record<string, number> = FACTORS[quantity];
  const f = table[unit];
  if (f === undefined) throw new DomainError(`Unknown ${quantity} unit: ${unit}`);
  return f;
}

function assertFinite(value: number): void {
  if (!Number.isFinite(value)) throw new DomainError('Value must be a finite number');
}

/** Presentation value to canonical. Distances are rounded to 1 mm (UNIDADES §5). */
export function toCanonical<Q extends Quantity>(
  quantity: Q,
  value: number,
  unit: UnitOf<Q>,
): number {
  assertFinite(value);
  const canonical = tidy(value * factor(quantity, unit));
  return quantity === 'distance' ? roundDistanceM(canonical) : canonical;
}

/** Canonical value to presentation, unrounded: rounding to a quantum is `roundToQuantum`. */
export function fromCanonical<Q extends Quantity>(
  quantity: Q,
  value: number,
  unit: UnitOf<Q>,
): number {
  assertFinite(value);
  return tidy(value / factor(quantity, unit));
}

/** Rounds metres to the canonical 0.001 m, in integer millimetres. */
export function roundDistanceM(metres: number): number {
  assertFinite(metres);
  const millimetres = Math.round(metres / DISTANCE_QUANTUM_M);
  return millimetres === 0 ? 0 : millimetres / 1000;
}
