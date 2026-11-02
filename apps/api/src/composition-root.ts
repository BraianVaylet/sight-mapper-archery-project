import type { MiddlewareHandler } from 'hono';
import { v7 as uuidv7 } from 'uuid';
import {
  createEnsureProfile,
  createProfileRepositories,
  createUpdatePreferences,
  registerAccountRoutes,
} from './modules/account/index.js';
import type { RouteRegistry } from './core/registry/registry.js';
import { createAuth } from './core/auth/auth.js';
import { createLogEmailSender, createResendSender, type EmailSender } from './core/auth/email.js';
import { sessionMiddleware } from './core/auth/session.js';
import { systemClock, type Clock } from './core/clock/clock.js';
import type { Env } from './core/config/env.js';
import type { DbConnection } from './core/db/connection.js';
import { createEventBus, type EventBus } from './core/events/bus.js';
import { purgeIdempotencyKeys } from './core/jobs/purge-idempotency-keys.js';
import { createScheduler, type Scheduler } from './core/jobs/scheduler.js';
import { createHttpApp, type HttpApp } from './core/http/app.js';
import { alwaysReady, type AppBindings, type Readiness } from './core/http/context.js';
import type { IdempotencyStore } from './core/idempotency/idempotency.js';
import type { Logger } from './core/logger/logger.js';

export type Container = HttpApp & {
  readonly env: Env;
  readonly logger: Logger;
  readonly bus: EventBus;
  /** Present with a database connection; `main` starts it. */
  readonly scheduler?: Scheduler;
};

export type ContainerDeps = {
  readonly env: Env;
  readonly logger: Logger;
  readonly clock?: Clock;
  readonly readiness?: Readiness;
  /**
   * With a database connection the container wires identity and the account module. Without
   * one (HTTP-only tests) it builds the bare HTTP core and takes `session` from the caller.
   */
  readonly connection?: DbConnection;
  /** How auth emails leave. Defaults to Resend, or to the log in `APP_ENV=local` without a key. */
  readonly emails?: EmailSender;
  readonly session?: MiddlewareHandler<AppBindings>;
  readonly idempotencyStore?: IdempotencyStore;
  readonly ifMatchExempt?: readonly string[];
};

/**
 * The one place that knows every piece: it wires modules, ports and event listeners so the
 * modules themselves never import each other (ADR-002). Modules plug in here as they land.
 */
export function createContainer(deps: ContainerDeps): Container {
  const { env, logger, connection } = deps;
  const clock = deps.clock ?? systemClock;
  const readiness = deps.readiness ?? alwaysReady;

  const bus = createEventBus();
  let session = deps.session;
  let authHandler: ((request: Request) => Promise<Response>) | undefined;
  let scheduler: Scheduler | undefined;
  let registerModuleRoutes: ((registry: RouteRegistry) => void) | undefined;

  if (connection !== undefined) {
    const profiles = createProfileRepositories(connection);
    const ensureProfile = createEnsureProfile({ profiles, newId: uuidv7, clock });
    const updatePreferences = createUpdatePreferences({ profiles, ensureProfile, clock });
    registerModuleRoutes = (registry) => {
      registerAccountRoutes(registry, { ensureProfile, updatePreferences });
    };
    // Awaited, so a failure reaches the publisher (which logs it) instead of an unhandled rejection.
    bus.on('UserRegistered', async ({ userId, locale }) => {
      await ensureProfile(userId, locale);
    });

    const auth = createAuth({
      env,
      connection,
      emails: deps.emails ?? defaultEmailSender(env, logger),
      bus,
      logger,
    });
    authHandler = auth.handler;
    scheduler = createScheduler({ connection, clock, logger, jobs: [purgeIdempotencyKeys] });
    session ??= sessionMiddleware(auth.sessions);
  }

  const http = createHttpApp({
    env,
    logger,
    clock,
    readiness,
    ...(session === undefined ? {} : { session }),
    ...(authHandler === undefined ? {} : { authHandler }),
    ...(deps.idempotencyStore === undefined ? {} : { idempotencyStore: deps.idempotencyStore }),
    ...(deps.ifMatchExempt === undefined ? {} : { ifMatchExempt: deps.ifMatchExempt }),
  });

  registerModuleRoutes?.(http.registry);

  return { ...http, env, logger, bus, ...(scheduler === undefined ? {} : { scheduler }) };
}

function defaultEmailSender(env: Env, logger: Logger): EmailSender {
  if (env.RESEND_API_KEY !== undefined && env.EMAIL_FROM !== undefined) {
    return createResendSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  // `parseEnv` only lets this through in APP_ENV=local.
  return createLogEmailSender(logger);
}
