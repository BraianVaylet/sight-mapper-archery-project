import { isApiError } from './api-error.js';

export const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4_000;
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * TanStack Query `retry` (errors.md §6.2): never on a 4xx, because repeating a request the server
 * understood and refused cannot change the answer. Up to two retries for a 5xx, a network
 * failure (`SM-NET-*`) and a 429. Anything that is not an `ApiError` (an abort) is not retried.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES || !isApiError(error)) return false;
  if (error.isNetwork) return true;
  return error.status === 429 || error.status >= 500;
}

/** TanStack Query `retryDelay`: exponential backoff, or what a 429 asks for (`retryAfterS`). */
export function retryDelay(failureCount: number, error: unknown): number {
  if (isApiError(error) && error.status === 429) {
    const seconds = error.params['retryAfterS'];
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    }
  }
  return Math.min(BASE_DELAY_MS * 2 ** failureCount, MAX_DELAY_MS);
}
