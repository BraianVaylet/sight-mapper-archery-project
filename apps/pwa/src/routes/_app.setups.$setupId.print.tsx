import { createFileRoute } from '@tanstack/react-router';
import * as z from 'zod/mini';
import { PrintScreen } from '../features/print/print-screen.js';

/**
 * The printable list. Like the distances screen, the view lives in the URL: the arrow set, and the
 * range and step of the list in the archer's unit. A value that does not parse is dropped.
 */
const search = z.object({
  arrowSet: z.catch(z.optional(z.string().check(z.maxLength(64))), undefined),
  step: z.catch(z.optional(z.number()), undefined),
  from: z.catch(z.optional(z.number().check(z.positive(), z.maximum(1000))), undefined),
  to: z.catch(z.optional(z.number().check(z.positive(), z.maximum(1000))), undefined),
});

export const Route = createFileRoute('/_app/setups/$setupId/print')({
  validateSearch: search,
  component: function PrintRoute() {
    const { setupId } = Route.useParams();
    const { arrowSet, step, from, to } = Route.useSearch();
    return <PrintScreen setupId={setupId} arrowSetId={arrowSet} step={step} from={from} to={to} />;
  },
});
