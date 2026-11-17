import { createFileRoute } from '@tanstack/react-router';
import { resetSearch } from '../features/auth/redirect.js';
import { GuestFrame } from '../app/guest-frame.js';
import { ResetScreen } from '../features/auth/reset-screen.js';

export const Route = createFileRoute('/reset-password')({
  validateSearch: resetSearch,
  component: function ResetRoute() {
    const { token, error } = Route.useSearch();
    return (
      <GuestFrame>
        <ResetScreen token={token} failed={error !== undefined} />
      </GuestFrame>
    );
  },
});
