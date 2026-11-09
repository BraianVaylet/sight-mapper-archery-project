import { createResourceHooks } from '@sight-mapper/client';
import { componentUsage, sight, type CreateSight, type UpdateSight } from '@sight-mapper/schemas';
import type { z } from 'zod';

/** The detail carries `usage`; list items do not: one schema reads both. */
const sightResource = sight.extend({ usage: componentUsage.optional() });

export type SightResource = z.infer<typeof sightResource>;

/** Every call to `/sights` (list, detail, add, edit, delete, archive) from one factory. */
export const sightHooks = createResourceHooks<SightResource, CreateSight, UpdateSight>({
  name: 'sights',
  path: '/sights',
  schema: sightResource,
});
