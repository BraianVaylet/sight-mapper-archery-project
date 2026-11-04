import { createFileRoute, redirect } from '@tanstack/react-router';
import { ProfileSync } from '../features/account/profile-sync.js';
import { profileQuery } from '../features/account/profile.js';
import { sessionQuery } from '../features/auth/session.js';
import { AppFrame } from '../features/menu/app-frame.js';

/** How long the first screen waits for the profile to know whether there is a quick access. */
const BOOT_WAIT_MS = 2500;

/** Everything behind the session. The guard asks the server; the API still decides every call. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location, preload }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQuery(context.clients.authHttp),
    );
    if (session === null) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }
    // A preload (hovering a link) is not the archer arriving: it neither redirects nor spends the boot.
    if (preload || !context.boot.pending) return;
    context.boot.pending = false;
    if (location.pathname !== '/') return;
    // Opening the app on the Home: if there is a quick access, go straight to that sight (HU-STP-03).
    // Without the profile the Home is a perfectly good place to be: no retries and a short wait,
    // the archer must not sit on the splash because the network is slow (SPEC: < 3 s on 4G).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const gaveUp = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), BOOT_WAIT_MS);
    });
    const me = await Promise.race([
      context.queryClient
        .fetchQuery({ ...profileQuery(context.clients.http), retry: false })
        .catch(() => null),
      gaveUp,
    ]).finally(() => clearTimeout(timer));
    if (me?.quickAccess != null) {
      throw redirect({
        to: '/setups/$setupId',
        params: { setupId: me.quickAccess.setupId },
        search: { arrowSet: me.quickAccess.arrowSetId },
        replace: true,
      });
    }
  },
  component: () => (
    <>
      <ProfileSync />
      <AppFrame />
    </>
  ),
});
