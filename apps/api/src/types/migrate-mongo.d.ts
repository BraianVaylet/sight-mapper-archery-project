// migrate-mongo ships no types. Only what the API and its tests call.
declare module 'migrate-mongo' {
  import type { mongo } from 'mongoose';

  type Db = mongo.Db;
  type MongoClient = mongo.MongoClient;

  export const config: {
    set(config: Record<string, unknown>): void;
  };
  export const database: {
    connect(): Promise<{ db: Db; client: MongoClient }>;
  };
  export function up(db: Db, client: MongoClient): Promise<string[]>;
  export function down(db: Db, client: MongoClient): Promise<string[]>;
  export function status(db: Db): Promise<{ fileName: string; appliedAt: string }[]>;
}
