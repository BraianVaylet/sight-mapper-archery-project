import { Schema, type SchemaDefinition, type SchemaOptions } from 'mongoose';
import { isolationPlugin } from './isolation.js';
import { softDeletePlugin } from './soft-delete.js';

/**
 * Fields every business collection carries (DICCIONARIO §3). `_id` is a UUIDv7 string made by
 * the client; `version` is ours (no `__v`) and is the `If-Match` of the API; timestamps are set
 * by the repositories from the injected clock, not by Mongoose.
 */
export const baseFields = {
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  version: { type: Number, required: true, default: 1, min: 1 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
} satisfies SchemaDefinition;

/** A schema with isolation and soft delete already applied: the only way models get built. */
export function createBusinessSchema(
  definition: SchemaDefinition,
  options: SchemaOptions = {},
): Schema {
  const schema = new Schema(
    { ...baseFields, ...definition },
    {
      versionKey: false,
      timestamps: false,
      ...options,
    },
  );
  schema.plugin(isolationPlugin);
  schema.plugin(softDeletePlugin);
  return schema;
}
