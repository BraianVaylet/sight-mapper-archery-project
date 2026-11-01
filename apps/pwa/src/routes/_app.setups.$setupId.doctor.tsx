import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '../features/placeholder.js';

export const Route = createFileRoute('/_app/setups/$setupId/doctor')({
  component: () => <Placeholder screen="doctor" />,
});
