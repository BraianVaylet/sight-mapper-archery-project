import { ApiError } from '@sight-mapper/client';
import type { SightScale } from '@sight-mapper/domain';
import { createTranslator, translateKey } from '@sight-mapper/i18n';
import { ERROR_CATALOG, type ErrorCode } from '@sight-mapper/types';
import { describe, expect, it } from 'vitest';
import { describeError } from './errors.js';

const translate = (key: string, params?: Record<string, string | number>) =>
  translateKey('es', key, params);

describe('describeError', () => {
  it('translates the key the API sent, with its params, and keeps the request id', () => {
    const error = new ApiError({
      code: 'SM-CORE-429-001',
      params: { retryAfterS: 12, ignored: { nested: true } },
      requestId: 'req-9',
    });
    const shown = describeError(translate, error);
    expect(shown.text).toBe(createTranslator('es')('errors.core.rateLimited', { retryAfterS: 12 }));
    expect(shown.requestId).toBe('req-9');
    expect(shown.code).toBe('SM-CORE-429-001');
  });

  it('shows the generic message for anything that is not an ApiError, never its text', () => {
    const shown = describeError(translate, new Error('secret stack detail'));
    expect(shown.text).toBe(createTranslator('es')('errors.core.unexpected'));
    expect(shown.text).not.toContain('secret');
    expect(shown.requestId).toBeUndefined();
  });
});

const CM: SightScale = {
  unit: 'cm',
  unitSizeMm: null,
  min: 0,
  max: 10,
  resolution: 0.1,
  direction: 'down',
};

const apiError = (code: ErrorCode, params: Record<string, unknown>) =>
  new ApiError({ code, params, requestId: 'r' });

describe("canonical params shown in the archer's system (ADR-005)", () => {
  const es = { system: 'metric', locale: 'es' } as const;

  it('shows a distance in metres or in yards, never the canonical number', () => {
    const error = apiError('SM-MARK-409-001', { existingMarkId: 'm1', distanceM: 45.72 });
    expect(describeError(translate, error, es).text).toBe('Ya tenés una marca a 45,7 m.');
    expect(describeError(translate, error, { ...es, system: 'imperial' }).text).toBe(
      'Ya tenés una marca a 50 yd.',
    );
  });

  it('shows the limits of a reading in the unit of the sight that is on screen', () => {
    const error = apiError('SM-MARK-422-001', { minMm: 0, maxMm: 100 });
    expect(describeError(translate, error, { ...es, scale: CM }).text).toBe(
      'La lectura está fuera de la escala de la mira (0,0–10,0).',
    );
  });

  it('shows a length of the equipment in mm or in inches when no sight is at hand', () => {
    const error = apiError('SM-SGT-409-002', { count: 3, minMm: 0, maxMm: 254 });
    expect(describeError(translate, error, es).text).toContain('254 mm');
    const imperial = describeError(translate, error, { ...es, system: 'imperial' }).text;
    expect(imperial).toContain('10,00 in');
    expect(imperial).not.toContain('mm');
  });

  it('shows an instant as a date', () => {
    const error = apiError('SM-ACC-409-001', { purgeAt: '2027-02-01T00:00:00Z' });
    const text = describeError(translate, error, es).text;
    expect(text).not.toContain('2027-02-01T');
    expect(text).toMatch(/2027/);
  });

  it('leaves no placeholder behind for any error of the catalog, in both languages and systems', () => {
    const sample: Record<string, unknown> = {
      distanceM: 45,
      minMm: 0,
      maxMm: 100,
      unitSizeMm: 10,
      purgeAt: '2027-02-01T00:00:00Z',
      deletedAt: '2026-11-01T00:00:00Z',
    };
    for (const [code, entry] of Object.entries(ERROR_CATALOG)) {
      const params = Object.fromEntries(entry.params.map((name) => [name, sample[name] ?? 3]));
      for (const locale of ['es', 'en'] as const) {
        for (const system of ['metric', 'imperial'] as const) {
          const text = describeError(
            (key, p) => translateKey(locale, key, p),
            apiError(code as ErrorCode, params),
            { system, locale, scale: CM },
          ).text;
          expect(text, `${code} ${locale} ${system}`).not.toMatch(/\{\{/);
        }
      }
    }
  });
});
