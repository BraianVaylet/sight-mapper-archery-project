import { createHttpClient, type HttpClient } from '@sight-mapper/client';

export type ApiClients = {
  /** The product API, under `/api/v1`. */
  http: HttpClient;
  /** Identity (Better Auth), under `/api/auth`: it answers in the same error envelope. */
  authHttp: HttpClient;
};

type Options = {
  /** Origin of the API. Empty means same origin (the Vite proxy in development). */
  origin?: string;
  fetch?: typeof fetch;
  onUnauthenticated?: () => void;
};

export function createApiClients({
  origin = '',
  fetch,
  onUnauthenticated,
}: Options = {}): ApiClients {
  const shared = {
    ...(fetch === undefined ? {} : { fetch }),
    ...(onUnauthenticated === undefined ? {} : { onUnauthenticated }),
  };
  return {
    http: createHttpClient({ baseUrl: `${origin}/api/v1`, ...shared }),
    // A wrong password is a 401 too, but it is not "your session expired": no redirect from here.
    authHttp: createHttpClient({
      baseUrl: `${origin}/api/auth`,
      ...(fetch === undefined ? {} : { fetch }),
    }),
  };
}
