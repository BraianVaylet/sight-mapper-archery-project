import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PrintScreen } from '../features/print/print-screen.js';

/**
 * The printable list. Like the distances screen, the view lives in the URL: the arrow set, and the
 * range and step of the list in the archer's unit. A value that does not parse is dropped.
 */
const search = z.object({
  arrowSet: z.string().max(64).optional().catch(undefined),
  step: z.number().optional().catch(undefined),
  from: z.number().positive().max(1000).optional().catch(undefined),
  to: z.number().positive().max(1000).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/setups/$setupId/print')({
  validateSearch: search,
  component: function PrintRoute() {
    const { setupId } = Route.useParams();
    const { arrowSet, step, from, to } = Route.useSearch();
    return <PrintScreen setupId={setupId} arrowSetId={arrowSet} step={step} from={from} to={to} />;
  },
});
