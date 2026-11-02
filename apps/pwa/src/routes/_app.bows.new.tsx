import { createFileRoute } from '@tanstack/react-router';
import { BowFormScreen } from '../features/equipment/bow-form-screen.js';

export const Route = createFileRoute('/_app/bows/new')({
  component: () => <BowFormScreen id={undefined} />,
});
