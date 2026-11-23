import type {
  ComponentUsage,
  CreateSight,
  SightScaleInput,
  UpdateSight,
} from '@sight-mapper/schemas';
import type { ScaleChangeStrategy } from '@sight-mapper/types';
import type { ComponentMeta, ComponentRepositories } from './component.js';

/** What the archer describes about a sight: the shape the API accepts, minus the id. */
export type SightFields = Omit<CreateSight, 'id'>;

export type Sight = SightFields & ComponentMeta;

/** What a PATCH writes: the sight's own fields, without the instructions about its marks. */
export type SightPatch = Omit<UpdateSight, 'scaleChangeStrategy' | 'windageScaleChangeStrategy'>;

export type SightRepositories = ComponentRepositories<Sight, SightPatch>;

/** How the marks of a sight must be treated when its scale changes (HU-SGT-02). */
export type ScaleChange = {
  readonly from: SightScaleInput;
  readonly to: SightScaleInput;
  readonly strategy: ScaleChangeStrategy | undefined;
  /**
   * Which scale changed (F1-42). For `windage`, `from` and `to` are the horizontal scales already
   * mapped onto an axis (`windageAxisScale`), so the same arithmetic applies.
   */
  readonly axis: 'vertical' | 'windage';
};

/**
 * Declared here, implemented by the calculator module (ARQUITECTURA §4.2): the marks that live on
 * a sight. Equipment never imports calculator. Until that module exists the answer is "none".
 */
export type SightMarksPort = {
  /**
   * Live marks measured on this sight, whatever the setup or arrow set. On the `windage` axis,
   * the setups of this sight that have a base windage written down (RN-SGT-05).
   */
  count(userId: string, sightId: string, axis?: ScaleChange['axis']): Promise<number>;
  /** How many marks would fall off the scale once `change` is applied. */
  countOutside(userId: string, sightId: string, change: ScaleChange): Promise<number>;
  /** Rewrites the marks for the new scale, keeping readings or positions. */
  rescale(userId: string, sightId: string, change: ScaleChange): Promise<void>;
};

export type SightUsagePort = {
  sightUsage(userId: string, sightId: string): Promise<ComponentUsage>;
};

export type { Clock } from './component.js';
