import { Temporal } from '@js-temporal/polyfill';

/**
 * The persistence translator: the only place where a `Date` is built or read. The rest of the
 * code speaks `Temporal.Instant` (UTC); MongoDB stores `Date` (DICCIONARIO §3).
 */
export function toDate(instant: Temporal.Instant): Date {
  return new Date(instant.epochMilliseconds);
}

export function fromDate(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}
