import type { ComponentUsage, CreateArrowSet, UpdateArrowSet } from '@sight-mapper/schemas';
import type { ComponentMeta, ComponentRepositories } from './component.js';

/** What the archer describes about a set of arrows: the shape the API accepts, minus the id. */
export type ArrowSetFields = Omit<CreateArrowSet, 'id'>;

export type ArrowSet = ArrowSetFields & ComponentMeta;

/** Declared here, answered by the calculator module: how many setups and marks use a set. */
export type ArrowSetUsagePort = {
  arrowSetUsage(userId: string, arrowSetId: string): Promise<ComponentUsage>;
};

export type ArrowSetRepositories = ComponentRepositories<ArrowSet, UpdateArrowSet>;
