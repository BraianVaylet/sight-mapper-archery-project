import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '../features/placeholder.js';

export const Route = createFileRoute('/reset-password')({
  component: () => <Placeholder screen="resetPassword" />,
});
