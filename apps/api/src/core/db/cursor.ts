import { Temporal } from '@js-temporal/polyfill';
import { AppError } from '../http/errors.js';
import { fromDate, toDate } from './temporal.js';

/**
 * The opaque cursor of every list (DICCIONARIO §4): base64url of the last item's
 * `(updatedAt, _id)`. The client only hands it back; what is inside may change.
 */
export type CursorPosition = { readonly updatedAt: Date; readonly id: string };

export function encodeCursor(position: CursorPosition): string {
  const payload = `${fromDate(position.updatedAt).epochMilliseconds}:${position.id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** A cursor that does not decode is a bad request, not a server error. */
export function decodeCursor(cursor: string): CursorPosition {
  const invalid = () =>
    new AppError('SM-CORE-400-001', {
      issues: [{ path: ['cursor'], messageKey: 'validation.invalid_format', params: {} }],
    });
  const text = Buffer.from(cursor, 'base64url').toString('utf8');
  const separator = text.indexOf(':');
  const millis = Number(text.slice(0, separator));
  const id = text.slice(separator + 1);
  if (separator < 1 || !Number.isSafeInteger(millis) || id === '') throw invalid();
  return { updatedAt: toDate(Temporal.Instant.fromEpochMilliseconds(millis)), id };
}
