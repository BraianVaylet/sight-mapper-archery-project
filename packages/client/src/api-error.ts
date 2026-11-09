import { ERROR_CATALOG, type ErrorCode, type ErrorMessageKey } from '@sight-mapper/types';

export type ApiErrorInit = {
  code: ErrorCode;
  params?: Readonly<Record<string, unknown>>;
  /** The server's `requestId`, for support. Absent for errors born in the client. */
  requestId?: string | undefined;
  /** The key the server sent, which may be newer than this build's catalog. */
  messageKey?: string | undefined;
  /** The HTTP status that arrived. Defaults to the status the code stands for. */
  httpStatus?: number | undefined;
  cause?: unknown;
};

/**
 * Every non-2xx answer, network failure and timeout, in one shape (errors.md §6). The UI
 * translates `messageKey` with `params` and never shows `message`.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: ErrorMessageKey | string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly requestId: string | undefined;
  readonly status: number;

  constructor(init: ApiErrorInit) {
    super(init.code, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'ApiError';
    this.code = init.code;
    this.messageKey = init.messageKey ?? ERROR_CATALOG[init.code].messageKey;
    this.params = init.params ?? {};
    this.requestId = init.requestId;
    // The transport status wins: a 401 from a proxy that sent no envelope is still a 401.
    this.status = init.httpStatus ?? ERROR_CATALOG[init.code].status;
  }

  /** Born in the client, not sent by the API. */
  get isNetwork(): boolean {
    return this.code.startsWith('SM-NET-');
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
