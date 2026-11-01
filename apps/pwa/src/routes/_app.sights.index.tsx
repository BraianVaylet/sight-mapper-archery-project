import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '../features/placeholder.js';

export const Route = createFileRoute('/_app/sights/')({
  component: () => <Placeholder screen="sights" />,
});
