import { createFileRoute } from '@tanstack/react-router';
import { SightFormScreen } from '../features/equipment/sight-form-screen.js';

export const Route = createFileRoute('/_app/sights/$id')({
  component: function SightRoute() {
    const { id } = Route.useParams();
    return <SightFormScreen id={id} />;
  },
});
