import { bowFields } from '@sight-mapper/schemas';
import type { SchemaDefinition } from 'mongoose';
import type { DbConnection } from '../../../core/db/connection.js';
import type { BowRepositories } from '../domain/bow.js';
import { createComponentRepositories } from './component-repository.js';

const TEXT_FIELDS = ['bowType', 'nickname', 'manufacturer', 'model', 'camType', 'rest', 'notes'];

/** Every descriptive field of a bow, from the shared schema: one list for both front and back. */
const definition: SchemaDefinition = Object.fromEntries(
  Object.keys(bowFields).map((name) => [
    name,
    name === 'bowType'
      ? { type: String, required: true }
      : { type: TEXT_FIELDS.includes(name) ? String : Number },
  ]),
);

export const createBowRepositories = (connection: DbConnection): BowRepositories =>
  createComponentRepositories({
    connection,
    modelName: 'Bow',
    collection: 'bows',
    resource: 'bow',
    definition,
  });
