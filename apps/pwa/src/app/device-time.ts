/**
 * The device's clock and time zone: the only file of the PWA that builds a `Date`, as
 * `core/db/temporal.ts` is in the API. Everything else asks here and works with ISO strings.
 */

/** Now, as an ISO instant. Used for what the screen shows before the server answers. */
export const nowIso = (): string => new Date().toISOString();

const pad = (n: number) => String(n).padStart(2, '0');

/** An instant as the value of a `datetime-local` input, in the zone of the device. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The value of a `datetime-local` input as an ISO instant; `undefined` when it is empty or unreadable. */
export function fromLocalInput(value: string): string | undefined {
  if (value.trim() === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
