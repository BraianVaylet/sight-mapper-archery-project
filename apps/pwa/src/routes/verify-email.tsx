import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '../features/placeholder.js';

export const Route = createFileRoute('/verify-email')({
  component: () => <Placeholder screen="verifyEmail" />,
});
