import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { NotFound, RouteError } from '../app/route-error.js';
import type { RouterContext } from '../app/router-context.js';
import { Shell } from '../app/shell.js';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
  errorComponent: RouteError,
  notFoundComponent: NotFound,
});
