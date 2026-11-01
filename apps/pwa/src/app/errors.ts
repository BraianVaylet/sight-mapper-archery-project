import { isApiError } from '@sight-mapper/client';
import type { Params } from '@sight-mapper/i18n';

type Translate = (key: string, params?: Params) => string;

/** The catalog only takes strings and numbers as placeholders; anything else is left visible. */
function displayParams(params: Readonly<Record<string, unknown>>): Params {
  const out: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') out[name] = value;
  }
  return out;
}

/**
 * What to show for a thrown value: the API's `messageKey` translated, never its prose; anything
 * that is not an `ApiError` is the generic "something went wrong". `requestId` is for support.
 */
export function describeError(
  translate: Translate,
  error: unknown,
): { text: string; requestId: string | undefined; code: string | undefined } {
  if (isApiError(error)) {
    return {
      text: translate(error.messageKey, displayParams(error.params)),
      requestId: error.requestId,
      code: error.code,
    };
  }
  return { text: translate('errors.core.unexpected'), requestId: undefined, code: undefined };
}
