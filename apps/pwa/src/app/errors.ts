import { isApiError } from '@sight-mapper/client';
import { formatReading, fromCanonical, mmToReading, type SightScale } from '@sight-mapper/domain';
import { decimalSeparator, formatDate, formatNumber, type Params } from '@sight-mapper/i18n';
import type { Locale, UnitSystem } from '@sight-mapper/types';

type Translate = (key: string, params?: Params) => string;

/**
 * What the archer sees the numbers in. The API speaks canonical units (metres, millimetres, UTC
 * instants) and the catalogs have display placeholders, so the two meet here (ADR-005).
 */
export type ErrorUnits = {
  readonly system: UnitSystem;
  readonly locale: Locale;
  /** The sight on screen, when the error is about a reading on it: min/max are shown in its unit. */
  readonly scale?: SightScale;
};

/** A length on the equipment, in the archer's system: `158,8 mm` or `6.25 in`. */
function showLength(mm: number, { system, locale }: ErrorUnits): string {
  if (system === 'metric') return `${formatNumber(mm, locale, Number.isInteger(mm) ? 0 : 1)} mm`;
  return `${formatNumber(fromCanonical('length', mm, 'in'), locale, 2)} in`;
}

/**
 * The canonical params of an error as the placeholders of its message: `distanceM` becomes
 * `distance` in m or yd, `minMm` / `maxMm` become `min` / `max` (in the unit of the sight when it
 * is known), instants become dates. Names the catalog does not use are left as they came.
 */
export function convertErrorParams(
  params: Readonly<Record<string, unknown>>,
  units: ErrorUnits,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...params };
  const { system, locale, scale } = units;

  // `distanceM` → `distance`, `maxDistanceM` → `maxDistance`: in metres or in yards.
  for (const [name, metres] of Object.entries(params)) {
    if (typeof metres !== 'number' || !/[dD]istanceM$/.test(name)) continue;
    const distance = system === 'metric' ? metres : fromCanonical('distance', metres, 'yd');
    out[name.slice(0, -1)] =
      `${formatNumber(distance, locale, Number.isInteger(distance) ? 0 : 1)} ${system === 'metric' ? 'm' : 'yd'}`;
  }

  const minMm = params['minMm'];
  const maxMm = params['maxMm'];
  if (typeof minMm === 'number' && typeof maxMm === 'number') {
    const separator = decimalSeparator(locale);
    out['min'] =
      scale === undefined
        ? showLength(minMm, units)
        : formatReading(mmToReading(minMm, scale), scale, separator);
    out['max'] =
      scale === undefined
        ? showLength(maxMm, units)
        : formatReading(mmToReading(maxMm, scale), scale, separator);
  }

  const unitSizeMm = params['unitSizeMm'];
  if (typeof unitSizeMm === 'number') out['unitSize'] = showLength(unitSizeMm, units);

  for (const name of ['purgeAt', 'deletedAt']) {
    const value = params[name];
    if (typeof value === 'string') out[name] = formatDate(value, locale);
  }
  return out;
}

/** The catalog only takes strings and numbers as placeholders; anything else is left visible. */
export function displayParams(
  params: Readonly<Record<string, unknown>>,
  units?: ErrorUnits,
): Params {
  const shown = units === undefined ? params : convertErrorParams(params, units);
  const out: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(shown)) {
    if (typeof value === 'string' || typeof value === 'number') out[name] = value;
  }
  return out;
}

/**
 * What to show for a thrown value: the API's `messageKey` translated, never its prose; anything
 * that is not an `ApiError` is the generic "something went wrong". `requestId` is for support.
 * With `units`, the canonical params are shown in the archer's system.
 */
export function describeError(
  translate: Translate,
  error: unknown,
  units?: ErrorUnits,
): { text: string; requestId: string | undefined; code: string | undefined } {
  if (isApiError(error)) {
    return {
      text: translate(error.messageKey, displayParams(error.params, units)),
      requestId: error.requestId,
      code: error.code,
    };
  }
  return { text: translate('errors.core.unexpected'), requestId: undefined, code: undefined };
}
