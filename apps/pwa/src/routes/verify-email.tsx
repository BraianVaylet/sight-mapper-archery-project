import { createFileRoute } from '@tanstack/react-router';
import { verifySearch } from '../features/auth/redirect.js';
import { VerifyScreen } from '../features/auth/verify-screen.js';

export const Route = createFileRoute('/verify-email')({
  validateSearch: verifySearch,
  component: function VerifyRoute() {
    const { error } = Route.useSearch();
    return <VerifyScreen failed={error !== undefined} />;
  },
});
