import { createFileRoute } from '@tanstack/react-router';
import { verifySearch } from '../features/auth/redirect.js';
import { GuestFrame } from '../app/guest-frame.js';
import { VerifyScreen } from '../features/auth/verify-screen.js';

export const Route = createFileRoute('/verify-email')({
  validateSearch: verifySearch,
  component: function VerifyRoute() {
    const { error } = Route.useSearch();
    return (
      <GuestFrame>
        <VerifyScreen failed={error !== undefined} />
      </GuestFrame>
    );
  },
});
