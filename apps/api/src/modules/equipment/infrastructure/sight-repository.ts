import type { SightScaleInput } from '@sight-mapper/schemas';
import { Schema, type SchemaDefinition } from 'mongoose';
import type { DbConnection } from '../../../core/db/connection.js';
import type { SightRepositories } from '../domain/sight.js';
import { createComponentRepositories } from './component-repository.js';

const TEXT_FIELDS = ['nickname', 'manufacturer', 'model', 'notes'];

const definition: SchemaDefinition = {
  pinType: { type: String, required: true },
  // The scale is one value: it is read and replaced as a whole, never patched key by key.
  scale: { type: Schema.Types.Mixed, required: true },
  ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, { type: String }])),
};

/** A `null` unit size and a missing one are the same: no physical size known. */
const cleanScale = (scale: SightScaleInput): SightScaleInput => ({
  unit: scale.unit,
  min: scale.min,
  max: scale.max,
  resolution: scale.resolution,
  direction: scale.direction,
  ...(scale.unitSizeMm == null ? {} : { unitSizeMm: scale.unitSizeMm }),
});

export const createSightRepositories = (connection: DbConnection): SightRepositories =>
  createComponentRepositories({
    connection,
    modelName: 'Sight',
    collection: 'sights',
    resource: 'sight',
    definition,
    store: (name, value) => (name === 'scale' ? cleanScale(value as SightScaleInput) : value),
  });
