import { arrowSetFields } from '@sight-mapper/schemas';
import type { SchemaDefinition } from 'mongoose';
import type { DbConnection } from '../../../core/db/connection.js';
import type { ArrowSetRepositories } from '../domain/arrow-set.js';
import { createComponentRepositories } from './component-repository.js';

const TEXT_FIELDS = ['name', 'manufacturer', 'model', 'vanes', 'vaneColor', 'nock', 'notes'];

/** Every descriptive field of a set, from the shared schema: one list for both front and back. */
const definition: SchemaDefinition = Object.fromEntries(
  Object.keys(arrowSetFields).map((name) => [
    name,
    name === 'name'
      ? { type: String, required: true }
      : { type: TEXT_FIELDS.includes(name) ? String : Number },
  ]),
);

export const createArrowSetRepositories = (connection: DbConnection): ArrowSetRepositories =>
  createComponentRepositories({
    connection,
    modelName: 'ArrowSet',
    collection: 'arrowSets',
    resource: 'arrow set',
    definition,
  });
