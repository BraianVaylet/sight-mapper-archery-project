import { isErrorCode } from '@sight-mapper/types';
import { z } from 'zod';
import { ApiError } from './api-error.js';

const envelope = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    messageKey: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
    requestId: z.string(),
    timestamp: z.string(),
  }),
});

/**
 * Reads the API's error envelope. Returns `null` when the body is not one (an HTML 502 from a
 * proxy, say), and the caller decides what that means.
 *
 * A code this build does not know (the server is newer) is kept as `SM-CORE-500-001` with the
 * server's own `messageKey`, so the archer sees the specific message if the catalog has it.
 */
export function parseErrorEnvelope(text: string): ApiError | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = envelope.safeParse(json);
  if (!parsed.success) return null;

  const { code, messageKey, params, requestId } = parsed.data.error;
  return new ApiError({
    code: isErrorCode(code) ? code : 'SM-CORE-500-001',
    messageKey,
    params,
    requestId,
  });
}
