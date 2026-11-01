import { z } from 'zod';

const BACKSLASH = String.fromCharCode(92);

/** Control characters (0x00-0x1f and 0x7f) have no place in a path. */
const hasControlCharacter = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

/**
 * Where to go after signing in. Only a path of this app: anything that could leave the origin
 * (`//evil.test`, `https://…`, a backslash trick) falls back to the home, so the sign-in page is
 * never an open redirect.
 */
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes(BACKSLASH) || hasControlCharacter(value)) {
    return fallback;
  }
  return value;
}

/** Search params of the public screens. Invalid values are dropped, not shown as an error. */
export const redirectSearch = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const tokenSearch = z.object({
  token: z.string().max(512).optional().catch(undefined),
});
