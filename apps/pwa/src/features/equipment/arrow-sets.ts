import { createResourceHooks } from '@sight-mapper/client';
import {
  arrowSet,
  componentUsage,
  type CreateArrowSet,
  type UpdateArrowSet,
} from '@sight-mapper/schemas';
import type { z } from 'zod';

/** The detail carries `usage`; list items do not: one schema reads both. */
const arrowSetResource = arrowSet.extend({ usage: componentUsage.optional() });

export type ArrowSetResource = z.infer<typeof arrowSetResource>;

/** Every call to `/arrow-sets` (list, detail, add, edit, delete, archive) from one factory. */
export const arrowSetHooks = createResourceHooks<ArrowSetResource, CreateArrowSet, UpdateArrowSet>({
  name: 'arrow-sets',
  path: '/arrow-sets',
  schema: arrowSetResource,
});
