import { createFileRoute } from '@tanstack/react-router';
import * as z from 'zod/mini';
import { SightScreen } from '../features/sight/sight-screen.js';

/**
 * The sight screen. What is on screen lives in the URL so a reload or a shared link keeps it
 * (FUNCIONAL §1.1): the arrow set and the selected distance in metres. A value that does not
 * parse is dropped, not shown as an error.
 */
const search = z.object({
  arrowSet: z.catch(z.optional(z.string().check(z.maxLength(64))), undefined),
  d: z.catch(z.optional(z.number().check(z.positive(), z.maximum(300))), undefined),
});

export const Route = createFileRoute('/_app/setups/$setupId/')({
  validateSearch: search,
  component: function SightRoute() {
    const { setupId } = Route.useParams();
    const { arrowSet, d } = Route.useSearch();
    return <SightScreen setupId={setupId} arrowSetId={arrowSet} distanceM={d} />;
  },
});
