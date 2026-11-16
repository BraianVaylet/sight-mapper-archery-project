import { AppError } from '../http/errors.js';

/** Minimum password length of the product (errors.md `SM-AUTH-400-001`). */
export const MIN_PASSWORD_LENGTH = 8;
export const USERNAME_PATTERN = '[a-z0-9._]{3,30}';

/**
 * Better Auth's own codes, by what they mean for us. Anything not listed falls back by HTTP
 * status. The provider's message is never forwarded: only keys and params leave the API.
 */
const BY_CODE: Readonly<Record<string, () => AppError>> = {
  INVALID_EMAIL_OR_PASSWORD: () => new AppError('SM-AUTH-401-001'),
  INVALID_USERNAME_OR_PASSWORD: () => new AppError('SM-AUTH-401-001'),
  EMAIL_NOT_VERIFIED: () => new AppError('SM-AUTH-403-001'),
  USER_ALREADY_EXISTS: () => new AppError('SM-AUTH-409-001'),
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: () => new AppError('SM-AUTH-409-001'),
  USERNAME_IS_ALREADY_TAKEN: () => new AppError('SM-AUTH-409-002'),
  PASSWORD_TOO_SHORT: () => new AppError('SM-AUTH-400-001', { minLength: MIN_PASSWORD_LENGTH }),
  INVALID_TOKEN: () => new AppError('SM-AUTH-400-002'),
  TOKEN_EXPIRED: () => new AppError('SM-AUTH-400-002'),
  INVALID_USERNAME: () => new AppError('SM-AUTH-400-003', { pattern: USERNAME_PATTERN }),
  USERNAME_TOO_SHORT: () => new AppError('SM-AUTH-400-003', { pattern: USERNAME_PATTERN }),
  USERNAME_TOO_LONG: () => new AppError('SM-AUTH-400-003', { pattern: USERNAME_PATTERN }),
  INVALID_DISPLAY_USERNAME: () => new AppError('SM-AUTH-400-003', { pattern: USERNAME_PATTERN }),
};

/** A non-2xx Better Auth response as one of our `AppError`s. */
export async function toAuthError(response: Response): Promise<AppError> {
  let code: string | undefined;
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    if (typeof body.code === 'string') code = body.code;
  } catch {
    // Not JSON (an HTML error page): the status alone decides.
  }

  // `hasOwn`: a code like `constructor` must not resolve through the prototype chain.
  const known = code !== undefined && Object.hasOwn(BY_CODE, code) ? BY_CODE[code] : undefined;
  if (known !== undefined) return known();

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('X-Retry-After'));
    return new AppError('SM-CORE-429-001', {
      retryAfterS: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60,
    });
  }
  if (response.status === 401) return new AppError('SM-CORE-401-001');
  if (response.status >= 500) return new AppError('SM-CORE-500-001');
  return new AppError('SM-CORE-400-001', { issues: [] });
}
