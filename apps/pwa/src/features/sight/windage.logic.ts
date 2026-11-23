import { scaleBoundsMm, type DecimalSeparator, type SightScale } from '@sight-mapper/domain';
import type { FieldError } from './mark-form.logic.js';
import { readReading, showReading } from './sight.logic.js';

export type WindageResult =
  { ok: true; windageMm: number | null } | { ok: false; error: FieldError };

/**
 * The base windage of a setup as typed (F1-42): read like a reading, but on the horizontal scale,
 * and checked against it so the archer is told at once. Empty means no windage written down.
 */
export function readWindage(
  text: string,
  windageScale: SightScale,
  separator: DecimalSeparator,
): WindageResult {
  if (text.trim() === '') return { ok: true, windageMm: null };
  const position = readReading(text, windageScale);
  if (position === null) {
    return { ok: false, error: { messageKey: 'mark.errors.number', params: {} } };
  }
  const { minMm, maxMm } = scaleBoundsMm(windageScale);
  if (position < minMm || position > maxMm) {
    return {
      ok: false,
      error: {
        messageKey: 'sight.windageOutOfScale',
        params: {
          min: showReading(minMm, windageScale, separator),
          max: showReading(maxMm, windageScale, separator),
        },
      },
    };
  }
  return { ok: true, windageMm: position };
}

/** A saved windage as the archer reads it on the horizontal scale; empty when there is none. */
export const showWindage = (
  windageMm: number | null,
  windageScale: SightScale,
  separator: DecimalSeparator,
): string => (windageMm === null ? '' : showReading(windageMm, windageScale, separator));
