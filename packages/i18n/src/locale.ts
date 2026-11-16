import { LOCALES, type Locale } from '@sight-mapper/types';
import { DEFAULT_LOCALE } from './translate.js';

/**
 * Picks the first supported language of `navigator.languages` (`es-AR` -> `es`); the initial
 * locale is the browser's, then `profile.locale` takes over (ADR-004).
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.trim().toLowerCase().split(/[-_]/)[0];
    const match = LOCALES.find((locale) => locale === base);
    if (match !== undefined) return match;
  }
  return DEFAULT_LOCALE;
}

/** `,` for `es`, `.` for `en`: what `formatDecimal` (domain) needs to show a reading. */
export function decimalSeparator(locale: Locale): '.' | ',' {
  const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
  return part?.value === ',' ? ',' : '.';
}

export function formatNumber(value: number, locale: Locale, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Formats an ISO instant in the device's zone (or `timeZone`). `Date.parse` only reads the
 * string; the domain never reads the clock.
 */
export function formatDateTime(iso: string, locale: Locale, timeZone?: string): string {
  const epochMs = Date.parse(iso);
  if (Number.isNaN(epochMs)) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(epochMs);
}

export function formatDate(iso: string, locale: Locale, timeZone?: string): string {
  const epochMs = Date.parse(iso);
  if (Number.isNaN(epochMs)) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(epochMs);
}
