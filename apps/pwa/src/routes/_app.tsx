import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ProfileSync } from '../features/account/profile-sync.js';
import { sessionQuery } from '../features/auth/session.js';

/** Everything behind the session. The guard asks the server; the API still decides every call. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQuery(context.clients.authHttp),
    );
    if (session === null) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }
  },
  component: () => (
    <>
      <ProfileSync />
      <Outlet />
    </>
  ),
});
