import type { CalcErrorCode } from '@sight-mapper/domain';
import type { Params } from '@sight-mapper/i18n';
import { ERROR_CATALOG } from '@sight-mapper/types';
import { displayParams, type ErrorUnits } from '../../app/errors.js';
import type { Reading } from './sight.logic.js';

/**
 * Why the marks do not allow a distance, in the archer's words and units: the domain answers with
 * a `SM-CALC-*` code and canonical params (metres), the catalog has display placeholders.
 */
export function calcFailureText(
  translate: (key: string, params?: Params) => string,
  reading: Reading,
  units: ErrorUnits,
): string {
  if (reading.ok) return '';
  return translate(
    ERROR_CATALOG[reading.code as CalcErrorCode].messageKey,
    displayParams(reading.params, units),
  );
}
