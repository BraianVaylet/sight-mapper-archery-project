import mongoose, { type ClientSession, type Connection } from 'mongoose';
import type { Readiness } from '../http/context.js';
import type { Logger } from '../logger/logger.js';

export type DbConnection = Connection;

/** Opens the connection. The replica set is required for transactions (ADR-009). */
export async function connectMongo(uri: string, logger: Logger): Promise<DbConnection> {
  mongoose.set('strictQuery', true);
  // Operations made inside `connection.transaction()` join it without being handed a session.
  mongoose.set('transactionAsyncLocalStorage', true);
  const connection = await mongoose
    .createConnection(uri, { serverSelectionTimeoutMS: 5_000, autoIndex: false })
    .asPromise();
  connection.on('disconnected', () => logger.warn('mongo disconnected'));
  connection.on('reconnected', () => logger.info('mongo reconnected'));
  return connection;
}

/**
 * Runs `work` in a transaction: all its writes commit together or none do. A throw rolls back
 * and propagates; the callback may be retried on transient errors, so keep it free of side
 * effects outside the session.
 */
export async function withTransaction<T>(
  connection: DbConnection,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  return connection.transaction((session) => work(session));
}

const READY_TIMEOUT_MS = 1_000;

/** `/ready`: Mongo answers a ping in under a second (TECNICO §5.1). */
export function mongoReadiness(connection: DbConnection, timeoutMs = READY_TIMEOUT_MS): Readiness {
  return {
    async check() {
      const db = connection.db;
      if (db === undefined) throw new Error('mongo not connected');
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('mongo ping timed out')), timeoutMs);
      });
      try {
        await Promise.race([db.admin().ping(), timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
