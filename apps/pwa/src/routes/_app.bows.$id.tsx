import { createFileRoute } from '@tanstack/react-router';
import { BowFormScreen } from '../features/equipment/bow-form-screen.js';

export const Route = createFileRoute('/_app/bows/$id')({
  component: function BowRoute() {
    const { id } = Route.useParams();
    return <BowFormScreen id={id} />;
  },
});
