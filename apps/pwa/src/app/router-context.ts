import type { QueryClient } from '@tanstack/react-query';
import type { ApiClients } from './api.js';

/** What every `beforeLoad` and loader can reach: the guard asks the session through these. */
export type RouterContext = {
  queryClient: QueryClient;
  clients: ApiClients;
  /**
   * Is the app still waiting for its first screen behind the session? The quick access (HU-STP-03)
   * only applies then: opening the app, or signing in to it. Going back to the Home later is not
   * a boot, and must not be thrown into a setup again.
   */
  boot: { pending: boolean };
};
