import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SetupFormScreen } from '../features/setups/setup-form-screen.js';

/**
 * What the archer has just loaded comes back chosen: `?bow=`, `?sight=`, `?arrowSet=` (F1-17). An id
 * that is not theirs is not an error here: the select simply has no such option.
 */
const id = z.string().max(64).optional().catch(undefined);
export const Route = createFileRoute('/_app/setups/new')({
  validateSearch: z.object({ bow: id, sight: id, arrowSet: id }),
  component: function NewSetupRoute() {
    const { bow, sight, arrowSet } = Route.useSearch();
    return <SetupFormScreen id={undefined} preselect={{ bow, sight, arrowSet }} />;
  },
});
