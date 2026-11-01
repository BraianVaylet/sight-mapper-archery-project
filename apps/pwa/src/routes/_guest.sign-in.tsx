import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '../features/placeholder.js';

export const Route = createFileRoute('/_guest/sign-in')({
  component: () => <Placeholder screen="signIn" />,
});
