import { createFileRoute } from '@tanstack/react-router';
import { SightFormScreen } from '../features/equipment/sight-form-screen.js';

export const Route = createFileRoute('/_app/sights/new')({
  component: () => <SightFormScreen id={undefined} />,
});
