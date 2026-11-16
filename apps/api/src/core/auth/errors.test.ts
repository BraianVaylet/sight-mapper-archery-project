import { describe, expect, it } from 'vitest';
import { toAuthError } from './errors.js';

const response = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
const provider = (code: string, status = 400) =>
  response({ code, message: 'Provider prose that must not leak' }, status);

describe('toAuthError', () => {
  it.each([
    ['INVALID_EMAIL_OR_PASSWORD', 401, 'SM-AUTH-401-001'],
    ['INVALID_USERNAME_OR_PASSWORD', 401, 'SM-AUTH-401-001'],
    ['EMAIL_NOT_VERIFIED', 403, 'SM-AUTH-403-001'],
    ['USER_ALREADY_EXISTS', 422, 'SM-AUTH-409-001'],
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 422, 'SM-AUTH-409-001'],
    ['USERNAME_IS_ALREADY_TAKEN', 422, 'SM-AUTH-409-002'],
    ['PASSWORD_TOO_SHORT', 400, 'SM-AUTH-400-001'],
    ['INVALID_TOKEN', 400, 'SM-AUTH-400-002'],
    ['TOKEN_EXPIRED', 400, 'SM-AUTH-400-002'],
    ['INVALID_USERNAME', 422, 'SM-AUTH-400-003'],
    ['USERNAME_TOO_SHORT', 422, 'SM-AUTH-400-003'],
    ['USERNAME_TOO_LONG', 422, 'SM-AUTH-400-003'],
    ['INVALID_DISPLAY_USERNAME', 422, 'SM-AUTH-400-003'],
  ])('%s becomes %s', async (providerCode, status, ours) => {
    const error = await toAuthError(provider(providerCode, status));
    expect(error.code).toBe(ours);
    expect(JSON.stringify(error.params)).not.toContain('prose');
  });

  it('carries the minimum length and the username pattern', async () => {
    expect((await toAuthError(provider('PASSWORD_TOO_SHORT'))).params).toEqual({ minLength: 8 });
    expect((await toAuthError(provider('INVALID_USERNAME'))).params).toEqual({
      pattern: '[a-z0-9._]{3,30}',
    });
  });

  it('turns a 429 into SM-CORE-429-001 with the wait the provider asked for', async () => {
    const error = await toAuthError(
      response({ message: 'Too many requests' }, 429, { 'X-Retry-After': '42' }),
    );
    expect(error.code).toBe('SM-CORE-429-001');
    expect(error.params).toEqual({ retryAfterS: 42 });
  });

  it('falls back to 60 s when a 429 gives no usable wait', async () => {
    for (const header of [undefined, 'soon', '-3', '0']) {
      const error = await toAuthError(
        response({}, 429, header === undefined ? {} : { 'X-Retry-After': header }),
      );
      expect(error.params).toEqual({ retryAfterS: 60 });
    }
  });

  it('maps by status when the code is unknown or there is none', async () => {
    expect((await toAuthError(provider('SOMETHING_NEW', 401))).code).toBe('SM-CORE-401-001');
    expect((await toAuthError(provider('SOMETHING_NEW', 500))).code).toBe('SM-CORE-500-001');
    expect((await toAuthError(provider('SOMETHING_NEW', 400))).code).toBe('SM-CORE-400-001');
    expect((await toAuthError(response({}, 404))).code).toBe('SM-CORE-400-001');
  });

  it('survives a body that is not JSON', async () => {
    expect((await toAuthError(response('<html>bad gateway</html>', 502))).code).toBe(
      'SM-CORE-500-001',
    );
    expect((await toAuthError(response('', 400))).code).toBe('SM-CORE-400-001');
  });

  it('does not let an inherited property pose as a provider code', async () => {
    expect((await toAuthError(provider('constructor', 400))).code).toBe('SM-CORE-400-001');
    expect((await toAuthError(provider('__proto__', 400))).code).toBe('SM-CORE-400-001');
  });
});
