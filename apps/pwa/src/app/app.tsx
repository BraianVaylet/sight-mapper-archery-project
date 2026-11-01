import { ClientProvider, queryClientConfig } from '@sight-mapper/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, useRouterState, type RouterHistory } from '@tanstack/react-router';
import { createAppRouter, type AppRouter } from '../router.js';
import { forgetSession } from '../features/auth/session.js';
import { createApiClients, type ApiClients } from './api.js';
import { ClientsProvider } from './clients.js';
import { I18nProvider } from './i18n.js';
import { Splash } from './route-error.js';

export type App = {
  queryClient: QueryClient;
  clients: ApiClients;
  router: AppRouter;
};

type AppOptions = {
  origin?: string;
  fetch?: typeof fetch;
  history?: RouterHistory;
};

/**
 * Builds the app's long-lived pieces once. Tests pass a fake `fetch` and a memory history, the
 * browser passes nothing: same code either way.
 */
export function createApp({ origin, fetch, history }: AppOptions = {}): App {
  const queryClient = new QueryClient(queryClientConfig);
  // The client needs the router to react to an expired session, the router needs the client for
  // its guard: the router is reached lazily.
  const holder: { router?: AppRouter } = {};
  const clients = createApiClients({
    ...(origin === undefined ? {} : { origin }),
    ...(fetch === undefined ? {} : { fetch }),
    onUnauthenticated: () => {
      forgetSession(queryClient);
      void holder.router?.invalidate();
    },
  });
  const router = createAppRouter({ queryClient, clients }, history);
  holder.router = router;
  return { queryClient, clients, router };
}

/**
 * On the very first load the router renders nothing until the guard has heard from the server
 * (it has no match to draw yet), so the splash lives outside it.
 */
function InitialSplash({ router }: { router: AppRouter }) {
  const empty = useRouterState({ router, select: (state) => state.matches.length === 0 });
  return empty ? <Splash /> : null;
}

export function AppRoot({ app }: { app: App }) {
  return (
    <QueryClientProvider client={app.queryClient}>
      <ClientProvider http={app.clients.http}>
        <ClientsProvider clients={app.clients}>
          <I18nProvider>
            <RouterProvider router={app.router} />
            <InitialSplash router={app.router} />
          </I18nProvider>
        </ClientsProvider>
      </ClientProvider>
    </QueryClientProvider>
  );
}
