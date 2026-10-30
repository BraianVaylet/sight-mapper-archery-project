import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error.js';
import { retryDelay, shouldRetry } from './retry.js';

const err = (
  code: ConstructorParameters<typeof ApiError>[0]['code'],
  params: Record<string, unknown> = {},
) => new ApiError({ code, params });

describe('shouldRetry', () => {
  it.each([
    'SM-CORE-400-001',
    'SM-CORE-401-001',
    'SM-CORE-404-002',
    'SM-MARK-409-001',
    'SM-CORE-412-001',
    'SM-MARK-422-001',
    'SM-STP-410-001',
  ] as const)('never retries the 4xx %s', (code) => {
    expect(shouldRetry(0, err(code))).toBe(false);
  });

  it.each(['SM-CORE-500-001', 'SM-CORE-503-001', 'SM-AUTH-502-001'] as const)(
    'retries the 5xx %s',
    (code) => {
      expect(shouldRetry(0, err(code))).toBe(true);
    },
  );

  it.each(['SM-NET-503-001', 'SM-NET-504-001', 'SM-NET-500-001'] as const)(
    'retries the network error %s',
    (code) => {
      expect(shouldRetry(0, err(code))).toBe(true);
    },
  );

  it('retries a 429', () => {
    expect(shouldRetry(1, err('SM-CORE-429-001', { retryAfterS: 3 }))).toBe(true);
  });

  it('stops after two retries', () => {
    const error = err('SM-CORE-503-001');
    expect([0, 1, 2, 3].map((n) => shouldRetry(n, error))).toEqual([true, true, false, false]);
  });

  it('does not retry what is not an ApiError, like an abort', () => {
    expect(shouldRetry(0, new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(shouldRetry(0, new Error('x'))).toBe(false);
    expect(shouldRetry(0, undefined)).toBe(false);
  });
});

describe('retryDelay', () => {
  it('backs off exponentially up to a cap', () => {
    const error = err('SM-CORE-503-001');
    expect([0, 1, 2, 3, 4, 10].map((n) => retryDelay(n, error))).toEqual([
      500, 1000, 2000, 4000, 4000, 4000,
    ]);
  });

  it('waits what a 429 asks for', () => {
    expect(retryDelay(0, err('SM-CORE-429-001', { retryAfterS: 12 }))).toBe(12_000);
    expect(retryDelay(0, err('SM-CORE-429-001', { retryAfterS: 0 }))).toBe(0);
  });

  it('caps an absurd retry-after', () => {
    expect(retryDelay(0, err('SM-CORE-429-001', { retryAfterS: 3600 }))).toBe(30_000);
  });

  it('falls back to backoff when a 429 gives no usable wait', () => {
    expect(retryDelay(1, err('SM-CORE-429-001'))).toBe(1000);
    expect(retryDelay(1, err('SM-CORE-429-001', { retryAfterS: 'soon' }))).toBe(1000);
    expect(retryDelay(1, err('SM-CORE-429-001', { retryAfterS: -5 }))).toBe(1000);
  });

  it('backs off for anything else', () => {
    expect(retryDelay(0, new Error('x'))).toBe(500);
  });
});

describe('ApiError', () => {
  it('derives status and messageKey from the code', () => {
    const e = new ApiError({ code: 'SM-CORE-412-001', params: { currentVersion: 3 } });
    expect(e.status).toBe(412);
    expect(e.messageKey).toBe('errors.core.staleWrite');
    expect(e.params).toEqual({ currentVersion: 3 });
    expect(e.requestId).toBeUndefined();
    expect(e.isNetwork).toBe(false);
    expect(e.name).toBe('ApiError');
  });

  it('keeps the cause', () => {
    const cause = new Error('boom');
    expect(new ApiError({ code: 'SM-NET-503-001', cause }).cause).toBe(cause);
  });
});
