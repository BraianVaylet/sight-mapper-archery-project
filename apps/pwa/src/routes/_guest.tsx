import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { redirectSearch, safeRedirect } from '../features/auth/redirect.js';
import { sessionQuery } from '../features/auth/session.js';

/** Sign-in, sign-up and recovery: someone already signed in has no business here. */
export const Route = createFileRoute('/_guest')({
  validateSearch: redirectSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQuery(context.clients.authHttp),
    );
    if (session !== null) throw redirect({ to: safeRedirect(search.redirect) });
  },
  component: Outlet,
});
