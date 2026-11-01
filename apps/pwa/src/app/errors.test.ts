import { ApiError } from '@sight-mapper/client';
import { createTranslator, translateKey } from '@sight-mapper/i18n';
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
