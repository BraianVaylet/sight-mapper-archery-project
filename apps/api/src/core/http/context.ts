import type { Logger } from '../logger/logger.js';

/** What the middleware puts on every request context. */
export type AppBindings = {
  Variables: {
    requestId: string;
    logger: Logger;
  };
};

/** Answers `/ready`: throws when a dependency (Mongo) cannot serve. */
export type Readiness = { check(): Promise<void> };

export const alwaysReady: Readiness = { check: () => Promise.resolve() };
