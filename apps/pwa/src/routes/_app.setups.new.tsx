import { createFileRoute } from '@tanstack/react-router';
import { SetupFormScreen } from '../features/setups/setup-form-screen.js';

export const Route = createFileRoute('/_app/setups/new')({
  component: () => <SetupFormScreen id={undefined} />,
});
