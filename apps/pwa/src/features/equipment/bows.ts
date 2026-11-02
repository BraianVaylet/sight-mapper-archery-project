import { createResourceHooks } from '@sight-mapper/client';
import type { z } from 'zod';
import { bow, componentUsage, type CreateBow, type UpdateBow } from '@sight-mapper/schemas';

/** The detail carries `usage`; list items do not: one schema reads both. */
const bowResource = bow.extend({ usage: componentUsage.optional() });

export type BowResource = z.infer<typeof bowResource>;

/** Every call to `/bows` (list, detail, add, edit, delete, archive) from one factory. */
export const bowHooks = createResourceHooks<BowResource, CreateBow, UpdateBow>({
  name: 'bows',
  path: '/bows',
  schema: bowResource,
});
