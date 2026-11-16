import { describe, expect, it } from 'vitest';
import {
  decimalSeparator,
  detectLocale,
  formatDate,
  formatDateTime,
  formatNumber,
} from './locale.js';

describe('detectLocale', () => {
  it('takes the first supported language of the browser', () => {
    expect(detectLocale(['es-AR', 'en-US'])).toBe('es');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['fr-FR', 'en-GB', 'es'])).toBe('en');
    expect(detectLocale(['ES_ar'])).toBe('es');
  });

  it('falls back to Spanish when nothing matches', () => {
    expect(detectLocale([])).toBe('es');
    expect(detectLocale(['pt-BR', 'de'])).toBe('es');
  });
});

describe('number and date formatting', () => {
  it('uses a comma in Spanish and a point in English', () => {
    expect(decimalSeparator('es')).toBe(',');
    expect(decimalSeparator('en')).toBe('.');
    expect(formatNumber(3.5, 'es', 1)).toBe('3,5');
    expect(formatNumber(3.5, 'en', 1)).toBe('3.5');
    expect(formatNumber(4, 'en')).toBe('4');
    expect(formatNumber(2, 'es', 2)).toBe('2,00');
  });

  it('formats an ISO instant in a given zone', () => {
    const iso = '2026-10-29T15:20:00Z';
    expect(formatDateTime(iso, 'en', 'UTC')).toContain('2026');
    expect(formatDateTime(iso, 'es', 'America/Argentina/Buenos_Aires')).toContain('12:20');
    expect(formatDate(iso, 'en', 'UTC')).toBe('Oct 29, 2026');
    expect(formatDate(iso, 'en')).toContain('2026');
    expect(formatDateTime(iso, 'es')).toContain('2026');
  });

  it('returns the input when it is not a date', () => {
    expect(formatDateTime('not a date', 'en')).toBe('not a date');
    expect(formatDate('', 'es')).toBe('');
  });
});
