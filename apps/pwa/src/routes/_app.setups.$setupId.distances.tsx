import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { DistancesScreen } from '../features/distances/distances-screen.js';

/**
 * Intermediate distances and the curve. The view lives in the URL so a reload or a shared link
 * keeps it (FUNCIONAL §1.1): the arrow set, the selected distance in metres, and the range and
 * step of the table in the archer's unit. A value that does not parse is dropped, not shown as
 * an error.
 */
const search = z.object({
  arrowSet: z.string().max(64).optional().catch(undefined),
  d: z.number().positive().max(300).optional().catch(undefined),
  step: z.number().optional().catch(undefined),
  from: z.number().positive().max(1000).optional().catch(undefined),
  to: z.number().positive().max(1000).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/setups/$setupId/distances')({
  validateSearch: search,
  component: function DistancesRoute() {
    const { setupId } = Route.useParams();
    const { arrowSet, d, step, from, to } = Route.useSearch();
    return (
      <DistancesScreen
        setupId={setupId}
        arrowSetId={arrowSet}
        distanceM={d}
        step={step}
        from={from}
        to={to}
      />
    );
  },
});
