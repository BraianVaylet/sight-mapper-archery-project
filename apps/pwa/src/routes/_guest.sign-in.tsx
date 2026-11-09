import { createFileRoute } from '@tanstack/react-router';
import { SignInScreen } from '../features/auth/sign-in-screen.js';

export const Route = createFileRoute('/_guest/sign-in')({
  component: function SignInRoute() {
    const { redirect } = Route.useSearch();
    return <SignInScreen redirect={redirect} />;
  },
});
