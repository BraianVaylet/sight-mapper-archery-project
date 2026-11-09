import { createFileRoute } from '@tanstack/react-router';
import * as z from 'zod/mini';
import { DistancesScreen } from '../features/distances/distances-screen.js';

/**
 * Intermediate distances and the curve. The view lives in the URL so a reload or a shared link
 * keeps it (FUNCIONAL §1.1): the arrow set, the selected distance in metres, and the range and
 * step of the table in the archer's unit. A value that does not parse is dropped, not shown as
 * an error.
 */
const search = z.object({
  arrowSet: z.catch(z.optional(z.string().check(z.maxLength(64))), undefined),
  d: z.catch(z.optional(z.number().check(z.positive(), z.maximum(300))), undefined),
  step: z.catch(z.optional(z.number()), undefined),
  from: z.catch(z.optional(z.number().check(z.positive(), z.maximum(1000))), undefined),
  to: z.catch(z.optional(z.number().check(z.positive(), z.maximum(1000))), undefined),
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
