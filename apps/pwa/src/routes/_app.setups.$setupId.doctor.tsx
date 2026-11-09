import { createFileRoute } from '@tanstack/react-router';
import * as z from 'zod/mini';
import { DoctorScreen } from '../features/doctor/doctor-screen.js';

/** The Mark Doctor. The arrow set on screen lives in the URL; a value that does not parse is dropped. */
const search = z.object({
  arrowSet: z.catch(z.optional(z.string().check(z.maxLength(64))), undefined),
});

export const Route = createFileRoute('/_app/setups/$setupId/doctor')({
  validateSearch: search,
  component: function DoctorRoute() {
    const { setupId } = Route.useParams();
    const { arrowSet } = Route.useSearch();
    return <DoctorScreen setupId={setupId} arrowSetId={arrowSet} />;
  },
});
