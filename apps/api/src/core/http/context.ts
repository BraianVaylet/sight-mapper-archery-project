import type { Logger } from '../logger/logger.js';

/** What the middleware puts on every request context. */
export type AppBindings = {
  Variables: {
    requestId: string;
    logger: Logger;
    /** Set by the session middleware from the cookie, never from the body or query (ADR-000). */
    userId?: string;
    /** Set by the `If-Match` guard on PATCH and DELETE: the version the client last saw. */
    ifMatch?: number;
  };
};

/** Answers `/ready`: throws when a dependency (Mongo) cannot serve. */
export type Readiness = { check(): Promise<void> };

export const alwaysReady: Readiness = { check: () => Promise.resolve() };
