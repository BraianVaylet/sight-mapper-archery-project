import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '../features/placeholder.js';

export const Route = createFileRoute('/_guest/forgot-password')({
  component: () => <Placeholder screen="forgotPassword" />,
});
