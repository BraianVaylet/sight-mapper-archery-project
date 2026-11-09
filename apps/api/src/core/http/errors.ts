import {
  ERROR_CATALOG,
  type ErrorCode,
  type ErrorEnvelope,
  type ErrorMessageKey,
} from '@sight-mapper/types';

/**
 * The only error the API throws on purpose (errors.md §5). The code must be declared in
 * docs/errors.md: an undeclared one does not compile.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'AppError';
  }

  get status(): number {
    return ERROR_CATALOG[this.code].status;
  }

  get messageKey(): ErrorMessageKey {
    return ERROR_CATALOG[this.code].messageKey;
  }
}

export function toEnvelope(error: AppError, requestId: string, timestamp: string): ErrorEnvelope {
  return {
    success: false,
    error: {
      code: error.code,
      messageKey: error.messageKey,
      params: error.params,
      requestId,
      timestamp,
    },
  };
}
