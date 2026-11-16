import { ERROR_CATALOG } from './errors.generated.js';

export { ERROR_CATALOG };

/** Every declared code. A code that is not in docs/errors.md does not compile (ADR-010). */
export type ErrorCode = keyof typeof ERROR_CATALOG;

export type ErrorMessageKey = (typeof ERROR_CATALOG)[ErrorCode]['messageKey'];

/** Where the error is raised: the API or the client (docs/errors.md §3). */
export type ErrorModule = (typeof ERROR_CATALOG)[ErrorCode]['module'];

export const ERROR_CODES = Object.keys(ERROR_CATALOG) as readonly ErrorCode[];

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ERROR_CATALOG, value);
}

export function errorStatus(code: ErrorCode): number {
  return ERROR_CATALOG[code].status;
}

export function errorMessageKey(code: ErrorCode): ErrorMessageKey {
  return ERROR_CATALOG[code].messageKey;
}

/** Wire format of every error response (docs/errors.md §2). No prose, only keys and params. */
export type ErrorEnvelope = {
  readonly success: false;
  readonly error: {
    readonly code: ErrorCode;
    readonly messageKey: ErrorMessageKey;
    readonly params: Readonly<Record<string, unknown>>;
    readonly requestId: string;
    readonly timestamp: string;
  };
};

/** One field-level problem inside a `SM-CORE-400-001` (`params.issues`). */
export type ValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly messageKey: string;
  readonly params: Readonly<Record<string, unknown>>;
};
