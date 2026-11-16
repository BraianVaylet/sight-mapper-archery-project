import type { QueryClientConfig } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import type { HttpClient } from './http.js';
import { retryDelay, shouldRetry } from './retry.js';

const HttpContext = createContext<HttpClient | null>(null);

/**
 * Gives every hook its HTTP client. Tests and the sandbox pass one with a fake `fetch`, so no
 * component ever builds its own client (TECNICO: "todo componente que trae datos acepta un
 * cliente inyectable").
 */
export function ClientProvider({ http, children }: { http: HttpClient; children: ReactNode }) {
  return <HttpContext.Provider value={http}>{children}</HttpContext.Provider>;
}

export function useHttp(): HttpClient {
  const http = useContext(HttpContext);
  if (http === null) throw new Error('useHttp needs a <ClientProvider> above it');
  return http;
}

/**
 * Defaults for `new QueryClient(...)`. Reads retry per errors.md §6.2. Mutations are not retried
 * by TanStack: a retry has to reuse the same `Idempotency-Key`, which the resource hooks arrange
 * by creating it once per user action.
 */
export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
};
