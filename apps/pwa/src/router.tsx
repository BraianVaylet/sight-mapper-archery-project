import { createMemoryHistory, createRouter, type RouterHistory } from '@tanstack/react-router';
import { NotFound, RouteError, Splash } from './app/route-error.js';
import type { RouterContext } from './app/router-context.js';
import { routeTree } from './routeTree.gen.js';

export function createAppRouter(context: RouterContext, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context,
    ...(history === undefined ? {} : { history }),
    defaultPreload: 'intent',
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
    defaultPendingComponent: Splash,
    // Short waits stay invisible; a longer one shows the splash for at least a moment (no flicker).
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

export const memoryHistory = (path: string) => createMemoryHistory({ initialEntries: [path] });

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
