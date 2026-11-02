import { createFileRoute } from '@tanstack/react-router';
import { ArrowFormScreen } from '../features/equipment/arrow-form-screen.js';

export const Route = createFileRoute('/_app/arrows/new')({
  component: () => <ArrowFormScreen id={undefined} />,
});
