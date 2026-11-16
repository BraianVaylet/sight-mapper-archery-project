import { createFileRoute } from '@tanstack/react-router';
import { resetSearch } from '../features/auth/redirect.js';
import { ResetScreen } from '../features/auth/reset-screen.js';

export const Route = createFileRoute('/reset-password')({
  validateSearch: resetSearch,
  component: function ResetRoute() {
    const { token, error } = Route.useSearch();
    return <ResetScreen token={token} failed={error !== undefined} />;
  },
});
