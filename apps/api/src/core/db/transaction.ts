import type { DbConnection } from './connection.js';

/**
 * Runs `work` as one transaction: everything it writes through the repositories commits together
 * or not at all, and a throw rolls it back and propagates. No session is passed around: Mongoose
 * attaches the transaction to every operation made inside `work` (`transactionAsyncLocalStorage`,
 * set in `connectMongo`), so the same use case code works with or without one.
 *
 * `work` may run again on a transient error, so it must not have effects outside the database.
 */
export type Transact = <T>(work: () => Promise<T>) => Promise<T>;

export const createTransact =
  (connection: DbConnection): Transact =>
  (work) =>
    connection.transaction(() => work());

/** For tests of the use cases without a database: the work simply runs. */
export const noTransaction: Transact = (work) => work();
