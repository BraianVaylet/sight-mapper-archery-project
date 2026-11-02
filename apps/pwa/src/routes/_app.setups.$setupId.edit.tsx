import { createFileRoute } from '@tanstack/react-router';
import { SetupFormScreen } from '../features/setups/setup-form-screen.js';

export const Route = createFileRoute('/_app/setups/$setupId/edit')({
  component: function EditSetupRoute() {
    const { setupId } = Route.useParams();
    return <SetupFormScreen id={setupId} />;
  },
});
