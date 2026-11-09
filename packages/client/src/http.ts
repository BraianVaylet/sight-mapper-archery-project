import { v7 as uuidv7 } from 'uuid';
import { ApiError } from './api-error.js';
import { parseErrorEnvelope } from './envelope.js';

export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Any Zod schema, classic or mini: all the client needs is `safeParse`. Typed by shape so the
 * client never imports the classic API, which does not tree-shake (TECNICO §14).
 */
export type Schema<T> = {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
};

export type Query = Readonly<Record<string, string | number | boolean | undefined>>;

export type RequestOptions<T = unknown> = {
  query?: Query;
  body?: unknown;
  /** The resource version the caller last saw: sent as `If-Match` (TECNICO §4). */
  version?: number;
  /** Reuse the key of an earlier attempt so a retry cannot create a second document. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Checks the body of a 2xx; a mismatch is `SM-NET-500-001`, not a crash somewhere else. */
  schema?: Schema<T>;
};

export type HttpClient = {
  get<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>;
  post<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>;
  put<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>;
  patch<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>;
  delete<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>;
  /** A fresh `Idempotency-Key`, for callers that retry (mutations). */
  newIdempotencyKey(): string;
};

export type HttpClientOptions = {
  /** Origin and prefix of the API, e.g. `https://api.example.com/api/v1`. */
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** `false` fails at once with `SM-NET-503-001` instead of waiting for a fetch to time out. */
  isOnline?: () => boolean;
  newIdempotencyKey?: () => string;
  /** Called on `SM-CORE-401-001`, before the error is thrown: redirect to sign-in. */
  onUnauthenticated?: () => void;
};

const defaultIsOnline = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * The typed `fetch` wrapper the whole app uses. It sends the session cookie, adds an
 * `Idempotency-Key` to every POST and an `If-Match` when told the version, gives up after 10 s,
 * and turns every failure into an `ApiError` (never prose, never a raw `TypeError`).
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    baseUrl,
    timeoutMs = REQUEST_TIMEOUT_MS,
    isOnline = defaultIsOnline,
    newIdempotencyKey = uuidv7,
    onUnauthenticated,
  } = options;
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function request<T>(
    method: string,
    path: string,
    opts: RequestOptions<T> = {},
  ): Promise<T> {
    if (!isOnline()) throw new ApiError({ code: 'SM-NET-503-001' });
    // Like fetch: a request cancelled before it starts never leaves.
    opts.signal?.throwIfAborted();
    assertSafePath(path);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (method === 'POST') headers['Idempotency-Key'] = opts.idempotencyKey ?? newIdempotencyKey();
    if (opts.version !== undefined) headers['If-Match'] = `"${opts.version}"`;

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      let response: Response;
      let text: string;
      try {
        response = await fetchImpl(buildUrl(baseUrl, path, opts.query), {
          method,
          headers,
          credentials: 'include',
          signal: controller.signal,
          ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
        });
        text = await response.text();
      } catch (cause) {
        if (timedOut) throw new ApiError({ code: 'SM-NET-504-001', cause });
        if (opts.signal?.aborted) throw cause; // the caller cancelled: not an error to report
        throw new ApiError({ code: 'SM-NET-503-001', cause });
      }

      if (!response.ok) {
        const error =
          parseErrorEnvelope(text, response.status) ??
          new ApiError({
            code: 'SM-NET-500-001',
            params: { status: response.status },
            httpStatus: response.status,
          });
        // By the status that arrived, not only by the envelope: a proxy can answer 401 with HTML.
        if (response.status === 401 || error.code === 'SM-CORE-401-001') onUnauthenticated?.();
        throw error;
      }
      return parseBody(text, opts.schema);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  return {
    get: (path, o) => request('GET', path, o),
    post: (path, o) => request('POST', path, o),
    put: (path, o) => request('PUT', path, o),
    patch: (path, o) => request('PATCH', path, o),
    delete: (path, o) => request('DELETE', path, o),
    newIdempotencyKey,
  };
}

function parseBody<T>(text: string, schema: Schema<T> | undefined): T {
  if (text === '') return undefined as T;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new ApiError({ code: 'SM-NET-500-001', cause });
  }
  if (schema === undefined) return json as T;
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError({ code: 'SM-NET-500-001', cause: parsed.error });
  return parsed.data;
}

/**
 * A path is a fixed route plus encoded ids. Anything that could climb out of it (`..`), start a
 * query (`?`) or a fragment (`#`) is a caller bug and never reaches the network.
 */
function assertSafePath(path: string): void {
  for (const segment of path.split('/')) {
    if (segment === '..' || segment === '.' || /[?#\\]/.test(segment)) {
      throw new TypeError(`Unsafe request path: ${path}`);
    }
  }
}

function buildUrl(baseUrl: string, path: string, query: Query | undefined): string {
  const url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  if (query === undefined) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search === '' ? url : `${url}?${search}`;
}
