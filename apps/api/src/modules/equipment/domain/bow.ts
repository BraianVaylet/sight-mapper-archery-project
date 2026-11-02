import type { ComponentUsage, CreateBow, UpdateBow } from '@sight-mapper/schemas';
import type { ComponentMeta, ComponentRepositories } from './component.js';

/** What the archer describes about a bow: the same shape the API accepts, minus the id. */
export type BowFields = Omit<CreateBow, 'id'>;

export type Bow = BowFields & ComponentMeta;

export type BowRepositories = ComponentRepositories<Bow, UpdateBow>;

/**
 * Declared here, implemented by the calculator module (ARQUITECTURA §4.2): how many setups and
 * marks lean on a bow. Equipment never imports calculator.
 */
export type ComponentUsagePort = {
  bowUsage(userId: string, bowId: string): Promise<ComponentUsage>;
};

export type { Clock } from './component.js';
