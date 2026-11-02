import { createFileRoute } from '@tanstack/react-router';
import { ArrowFormScreen } from '../features/equipment/arrow-form-screen.js';

export const Route = createFileRoute('/_app/arrows/$id')({
  component: function ArrowRoute() {
    const { id } = Route.useParams();
    return <ArrowFormScreen id={id} />;
  },
});
