import { DomainError } from '../errors.js';
import { FIXED_UNIT_SIZE_MM } from './constants.js';
import { tidy } from './quantity.js';
import { formatDecimal, roundToQuantum, type DecimalSeparator } from './quantum.js';

export type ScaleUnit = 'mm' | 'cm' | 'in' | 'click' | 'custom';

/** How an archer's reading maps to a position on the scale (DOMINIO §2.2). */
export type SightScale = {
  readonly unit: ScaleUnit;
  readonly unitSizeMm: number | null;
  readonly min: number;
  readonly max: number;
  readonly resolution: number;
  readonly direction: 'down' | 'up';
};

/**
 * Millimetres per scale unit. `mm`, `cm` and `in` are fixed; `click` and `custom` use the size
 * the archer loaded, or a nominal 1 when there is none (no physical scale).
 */
export function unitSizeMm(scale: Pick<SightScale, 'unit' | 'unitSizeMm'>): number {
  if (scale.unit === 'mm' || scale.unit === 'cm' || scale.unit === 'in') {
    return FIXED_UNIT_SIZE_MM[scale.unit];
  }
  if (scale.unitSizeMm === null) return 1;
  if (!Number.isFinite(scale.unitSizeMm) || scale.unitSizeMm <= 0) {
    throw new DomainError('unitSizeMm must be a finite number greater than zero');
  }
  return scale.unitSizeMm;
}

/** True when the sight has a real size per unit, so a 1:1 ruler or tape makes sense. */
export function hasPhysicalScale(scale: Pick<SightScale, 'unit' | 'unitSizeMm'>): boolean {
  return (
    scale.unit === 'mm' || scale.unit === 'cm' || scale.unit === 'in' || scale.unitSizeMm !== null
  );
}

/** What the archer reads on the sight to a position in mm: `lectura x unitSizeMm`. */
export function readingToMm(
  reading: number,
  scale: Pick<SightScale, 'unit' | 'unitSizeMm'>,
): number {
  if (!Number.isFinite(reading)) throw new DomainError('Reading must be a finite number');
  return tidy(reading * unitSizeMm(scale));
}

/** A position in mm to what the archer reads: `posicionMm / unitSizeMm`. */
export function mmToReading(mm: number, scale: Pick<SightScale, 'unit' | 'unitSizeMm'>): number {
  if (!Number.isFinite(mm)) throw new DomainError('Position must be a finite number');
  return tidy(mm / unitSizeMm(scale));
}

/** Scale limits in mm, as `calculateGrid` expects them. */
export function scaleBoundsMm(scale: SightScale): { minMm: number; maxMm: number } {
  return { minMm: readingToMm(scale.min, scale), maxMm: readingToMm(scale.max, scale) };
}

/** `unitSizeMm` for a `custom` scale from the measured length between `min` and `max`. */
export function unitSizeFromLength(lengthMm: number, min: number, max: number): number {
  if (
    !Number.isFinite(lengthMm) ||
    lengthMm <= 0 ||
    !Number.isFinite(min) ||
    !Number.isFinite(max)
  ) {
    throw new DomainError('Length must be positive and the range finite');
  }
  if (max <= min) throw new DomainError('max must be greater than min');
  return tidy(lengthMm / (max - min));
}

/** A reading rounded to the sight's quantum, as the archer can actually set it. */
export function roundReading(reading: number, scale: Pick<SightScale, 'resolution'>): number {
  return roundToQuantum(reading, scale.resolution);
}

export function formatReading(
  reading: number,
  scale: Pick<SightScale, 'resolution'>,
  separator: DecimalSeparator = '.',
): string {
  return formatDecimal(reading, scale.resolution, separator);
}
