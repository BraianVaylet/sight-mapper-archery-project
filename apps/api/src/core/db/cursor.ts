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

/**
 * A cursor over lists ordered by a flag first (favourites before the rest), then by
 * `(updatedAt, _id)`: base64url of the flag, the instant and the id.
 */
export type GroupedCursorPosition = CursorPosition & { readonly group: boolean };

export function encodeGroupedCursor(position: GroupedCursorPosition): string {
  const payload = `${position.group ? 1 : 0}:${fromDate(position.updatedAt).epochMilliseconds}:${position.id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeGroupedCursor(cursor: string): GroupedCursorPosition {
  const text = Buffer.from(cursor, 'base64url').toString('utf8');
  const first = text.indexOf(':');
  const second = text.indexOf(':', first + 1);
  const millis = Number(text.slice(first + 1, second));
  const id = text.slice(second + 1);
  const group = text.slice(0, first);
  if (
    first < 1 ||
    second < 0 ||
    (group !== '0' && group !== '1') ||
    !Number.isSafeInteger(millis) ||
    id === ''
  ) {
    throw new AppError('SM-CORE-400-001', {
      issues: [{ path: ['cursor'], messageKey: 'validation.invalid_format', params: {} }],
    });
  }
  return {
    group: group === '1',
    updatedAt: toDate(Temporal.Instant.fromEpochMilliseconds(millis)),
    id,
  };
}
