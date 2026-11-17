import { createFileRoute, redirect } from '@tanstack/react-router';

/** The old address of the settings (FUNCIONAL §1.1): bookmarks and shortcuts still land. */
export const Route = createFileRoute('/_app/settings/appearance')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', replace: true });
  },
});
