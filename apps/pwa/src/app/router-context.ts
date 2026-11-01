import type { QueryClient } from '@tanstack/react-query';
import type { ApiClients } from './api.js';

/** What every `beforeLoad` and loader can reach: the guard asks the session through these. */
export type RouterContext = {
  queryClient: QueryClient;
  clients: ApiClients;
};
