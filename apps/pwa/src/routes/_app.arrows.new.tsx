import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { afterSaveSearch } from '../features/equipment/after-save.js';
import { ArrowFormScreen } from '../features/equipment/arrow-form-screen.js';

/** `?next=` says where to go after saving: back to the Home guide, or on to the new setup (F1-17). */
export const Route = createFileRoute('/_app/arrows/new')({
  validateSearch: z.object({ next: afterSaveSearch }),
  component: function NewRoute() {
    const { next } = Route.useSearch();
    return <ArrowFormScreen id={undefined} next={next} />;
  },
});
