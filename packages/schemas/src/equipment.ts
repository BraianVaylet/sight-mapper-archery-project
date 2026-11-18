import {
  BOW_TYPES,
  CAM_TYPES,
  PIN_TYPES,
  SCALE_CHANGE_STRATEGIES,
  SCALE_DIRECTIONS,
  SCALE_UNITS,
} from '@sight-mapper/types';
import { z } from 'zod';
import { at, bounded, componentStatus, optional, resourceFields, text, uuidv7 } from './common.js';

// All numeric ranges are canonical units (DICCIONARIO §3): mm, g, N, m/s.

/** A closed range `[min, max]` in canonical units. */
export type Range = readonly [min: number, max: number];

/**
 * The ranges of the bow (DICCIONARIO §3.1, RN-EQP-03): real gear from youth to heavy hunting, plus a
 * margin against typos. They only ever widen: a stored value must stay savable. The form shows them
 * in the unit of the bow section.
 */
export const BOW_RANGES = {
  iboSpeedMps: [45, 135],
  letOffPct: [0, 99],
  drawLengthMm: [300, 900],
  drawWeightN: [20, 450],
  axleToAxleMm: [500, 1200],
  braceHeightMm: [100, 260],
  sightRadiusMm: [400, 1200],
  peepHeightMm: [20, 250],
  dLoopLengthMm: [5, 150],
} as const satisfies Record<string, Range>;

/** The ranges of an arrow set (DICCIONARIO §3.3, RN-EQP-03); same rules as `BOW_RANGES`. */
export const ARROW_RANGES = {
  spine: [100, 2600],
  cutLengthMm: [300, 900],
  gpi: [2, 30],
  pointWeightG: [1, 30],
  extraWeightG: [0, 30],
  totalWeightG: [10, 60],
  vaneCount: [2, 6],
  measuredSpeedMps: [30, 135],
} as const satisfies Record<string, Range>;

const inRange = ([min, max]: Range) => optional(bounded(min, max));

const hasManufacturerOrModel = (v: {
  manufacturer?: string | null | undefined;
  model?: string | null | undefined;
}) => Boolean(v.manufacturer) || Boolean(v.model);
const needManufacturerOrModel = at(['manufacturer'], 'validation.equipment.manufacturerOrModel');

// ---------------------------------------------------------------- bows

export const bowFields = {
  bowType: z.enum(BOW_TYPES),
  nickname: optional(text(1, 40)),
  manufacturer: optional(text(1, 60)),
  model: optional(text(1, 60)),
  iboSpeedMps: inRange(BOW_RANGES.iboSpeedMps),
  letOffPct: inRange(BOW_RANGES.letOffPct),
  drawLengthMm: inRange(BOW_RANGES.drawLengthMm),
  drawWeightN: inRange(BOW_RANGES.drawWeightN),
  camType: optional(z.enum(CAM_TYPES)),
  axleToAxleMm: inRange(BOW_RANGES.axleToAxleMm),
  braceHeightMm: inRange(BOW_RANGES.braceHeightMm),
  sightRadiusMm: inRange(BOW_RANGES.sightRadiusMm),
  peepHeightMm: inRange(BOW_RANGES.peepHeightMm),
  dLoopLengthMm: inRange(BOW_RANGES.dLoopLengthMm),
  rest: optional(z.string().trim().max(80)),
  notes: optional(z.string().trim().max(500)),
};

export const createBow = z
  .object({ id: uuidv7, ...bowFields })
  .refine(hasManufacturerOrModel, needManufacturerOrModel);
export type CreateBow = z.infer<typeof createBow>;

/** Partial edit; whether the merged result still names the bow is checked by the use case. */
export const updateBow = z.object(bowFields).partial();
export type UpdateBow = z.infer<typeof updateBow>;

export const bow = z.object({
  ...resourceFields,
  ...bowFields,
  status: componentStatus,
});
export type Bow = z.infer<typeof bow>;

// -------------------------------------------------------------- sights

/** Fixed mm per unit for non-custom scales (UNIDADES §3). Mirrors the domain constants. */
const FIXED_UNIT_SIZE_MM = { mm: 1, cm: 10, in: 25.4 } as const;

export const sightScale = z
  .object({
    unit: z.enum(SCALE_UNITS),
    unitSizeMm: optional(z.number().gt(0)),
    min: z.number(),
    max: z.number(),
    resolution: z.number().gt(0),
    direction: z.enum(SCALE_DIRECTIONS).default('down'),
  })
  .superRefine((scale, ctx) => {
    if (scale.min >= scale.max) {
      ctx.addIssue({ code: 'custom', path: ['max'], message: 'validation.scale.minLessThanMax' });
    } else if (scale.resolution > scale.max - scale.min) {
      ctx.addIssue({
        code: 'custom',
        path: ['resolution'],
        message: 'validation.scale.resolutionTooLarge',
      });
    }

    if (scale.unit === 'mm' || scale.unit === 'cm' || scale.unit === 'in') {
      const fixed = FIXED_UNIT_SIZE_MM[scale.unit];
      if (scale.unitSizeMm != null && scale.unitSizeMm !== fixed) {
        ctx.addIssue({
          code: 'custom',
          path: ['unitSizeMm'],
          message: 'validation.sight.fixedUnitSize',
        });
      }
    }
  });
export type SightScaleInput = z.infer<typeof sightScale>;

export const sightFields = {
  nickname: optional(text(1, 40)),
  manufacturer: optional(text(1, 60)),
  model: optional(text(1, 60)),
  /** No default here: `.partial()` keeps defaults and a PATCH would reset the stored pin. */
  pinType: z.enum(PIN_TYPES),
  scale: sightScale,
  notes: optional(z.string().trim().max(500)),
};

export const createSight = z
  .object({ id: uuidv7, ...sightFields, pinType: sightFields.pinType.default('monopin') })
  .refine(hasManufacturerOrModel, needManufacturerOrModel);
export type CreateSight = z.infer<typeof createSight>;

export const updateSight = z
  .object({
    ...sightFields,
    /** Required by the API when the unit or size changes and the sight already has marks. */
    scaleChangeStrategy: z.enum(SCALE_CHANGE_STRATEGIES),
  })
  .partial();
export type UpdateSight = z.infer<typeof updateSight>;

export const sight = z.object({
  ...resourceFields,
  ...sightFields,
  status: componentStatus,
});
export type Sight = z.infer<typeof sight>;

// ---------------------------------------------------------- arrow sets

const shortText = (max: number) => optional(z.string().trim().max(max));

export const arrowSetFields = {
  name: text(1, 40),
  manufacturer: shortText(60),
  model: shortText(60),
  spine: inRange(ARROW_RANGES.spine),
  cutLengthMm: inRange(ARROW_RANGES.cutLengthMm),
  gpi: inRange(ARROW_RANGES.gpi),
  pointWeightG: inRange(ARROW_RANGES.pointWeightG),
  extraWeightG: inRange(ARROW_RANGES.extraWeightG),
  totalWeightG: inRange(ARROW_RANGES.totalWeightG),
  vanes: shortText(60),
  vaneCount: optional(z.int().min(ARROW_RANGES.vaneCount[0]).max(ARROW_RANGES.vaneCount[1])),
  vaneColor: shortText(30),
  nock: shortText(60),
  measuredSpeedMps: inRange(ARROW_RANGES.measuredSpeedMps),
  notes: optional(z.string().trim().max(500)),
};

export const createArrowSet = z.object({ id: uuidv7, ...arrowSetFields });
export type CreateArrowSet = z.infer<typeof createArrowSet>;

export const updateArrowSet = z.object(arrowSetFields).partial();
export type UpdateArrowSet = z.infer<typeof updateArrowSet>;

export const arrowSet = z.object({
  ...resourceFields,
  ...arrowSetFields,
  status: componentStatus,
});
export type ArrowSet = z.infer<typeof arrowSet>;

/** `GET /:id` adds how much of the account uses the component (TECNICO §5.3). */
export const componentUsage = z.object({
  setups: z.int().min(0),
  marks: z.int().min(0),
});
export type ComponentUsage = z.infer<typeof componentUsage>;

/** `GET /bows/:id`: the bow plus what uses it (the delete is refused while setups do). */
export const bowDetail = bow.extend({ usage: componentUsage });
export type BowDetail = z.infer<typeof bowDetail>;

/** `GET /sights/:id`: the sight plus what uses it. */
export const sightDetail = sight.extend({ usage: componentUsage });
export type SightDetail = z.infer<typeof sightDetail>;

/** `GET /arrow-sets/:id`: the set plus what uses it. */
export const arrowSetDetail = arrowSet.extend({ usage: componentUsage });
export type ArrowSetDetail = z.infer<typeof arrowSetDetail>;
