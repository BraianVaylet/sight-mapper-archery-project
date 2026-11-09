import type { MiddlewareHandler } from 'hono';
import { v7 as uuidv7 } from 'uuid';
import {
  createCancelDeletion,
  createClearQuickAccessOfSetup,
  createEnsureProfile,
  createExportData,
  createProfileRepositories,
  createPurgeDeletedAccounts,
  createPurgeProfile,
  createRequestDeletion,
  createSetQuickAccess,
  createUpdatePreferences,
  registerAccountRoutes,
} from './modules/account/index.js';
import {
  createCheckComponents,
  createCreateMark,
  createMarkChecks,
  createMarkRepositories,
  createMarkUseCases,
  createSetupMarks,
  createSightMarks,
  createUpdateMark,
  registerMarkRoutes,
  createComponentUsage,
  createCreateSetup,
  createCalculatorExport,
  createPurgeCalculatorData,
  createSetupLookup,
  createSetupRepositories,
  createSetupUseCases,
  createSetupViews,
  createUpdateSetup,
  purgeDeletedSetups,
  registerSetupRoutes,
  type SetupMarksPort,
} from './modules/calculator/index.js';
import {
  createArrowSetRepositories,
  createEquipmentExport,
  createEquipmentReader,
  createPurgeEquipment,
  createBowRepositories,
  createComponentUseCases,
  createCreateArrowSet,
  createUpdateArrowSet,
  registerArrowSetRoutes,
  type ArrowSetUsagePort,
  createCreateSight,
  createSightRepositories,
  createUpdateSight,
  registerSightRoutes,
  type SightMarksPort,
  type SightUsagePort,
  createCreateBow,
  createUpdateBow,
  registerBowRoutes,
  type ComponentUsagePort,
} from './modules/equipment/index.js';
import type { RouteRegistry } from './core/registry/registry.js';
import { createAuth } from './core/auth/auth.js';
import { deleteIdentity } from './core/auth/identity.js';
import { deleteAllOf } from './core/db/export.js';
import { createLogEmailSender, createResendSender, type EmailSender } from './core/auth/email.js';
import { sessionMiddleware } from './core/auth/session.js';
import { systemClock, type Clock } from './core/clock/clock.js';
import type { Env } from './core/config/env.js';
import type { DbConnection } from './core/db/connection.js';
import { createTransact } from './core/db/transaction.js';
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
  /** How many setups and marks use a bow. The calculator module provides it; until then, zero. */
  readonly componentUsage?: ComponentUsagePort & SightUsagePort & ArrowSetUsagePort;
  /** The marks that live on a sight. The calculator module provides it; until then, none. */
  readonly sightMarks?: SightMarksPort;
  /** The marks of each setup (F1-07 implements it); until then, none. */
  readonly setupMarks?: SetupMarksPort;
};

/**
 * Writes that do not carry `If-Match`. Withdrawing a request for deletion is the way out of
 * something the archer asked for: it must work whatever else changed in their profile since (a
 * theme changed in another tab), so it is never a stale write.
 */
const IF_MATCH_EXEMPT: readonly string[] = ['DELETE /api/v1/me/deletion-request'];

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
    const arrowSets = createArrowSetRepositories(connection);
    const sights = createSightRepositories(connection);
    const bows = createBowRepositories(connection);
    const setups = createSetupRepositories(connection);
    // The account asks the calculator which arrow sets a setup has; it never imports it (ADR-002).
    const setQuickAccess = createSetQuickAccess({
      profiles,
      ensureProfile,
      setups: createSetupLookup({ setups }),
      clock,
    });
    const clearQuickAccessOfSetup = createClearQuickAccessOfSetup({ profiles, clock });
    const requestDeletion = createRequestDeletion({ profiles, ensureProfile, clock, bus });
    const cancelDeletion = createCancelDeletion({ profiles, ensureProfile, clock });
    // Each module hands over its own rows: the account never reads their collections (ADR-002).
    const exportData = createExportData({
      ensureProfile,
      clock,
      sources: [createEquipmentExport(connection), createCalculatorExport(connection)],
    });

    const marks = createMarkRepositories(connection);
    const transact = createTransact(connection);

    // The marks are the calculator's, and equipment and the setups ask about them through ports.
    // Tests may hand in their own to give a setup or a sight marks without recording any.
    const setupMarks: SetupMarksPort = deps.setupMarks ?? createSetupMarks({ marks });
    const sightMarks: SightMarksPort =
      deps.sightMarks ?? createSightMarks({ setups, marks, clock });

    // Equipment asks the calculator how much leans on a component (ADR-008); the calculator asks
    // equipment who each component is. Neither imports the other: only this file knows both.
    const equipment = createEquipmentReader({ bows, sights, arrowSets });
    const usage: ComponentUsagePort & SightUsagePort & ArrowSetUsagePort =
      deps.componentUsage ?? createComponentUsage({ setups, marks: setupMarks });
    const check = createCheckComponents(equipment);
    const views = createSetupViews({ equipment, marks: setupMarks });
    const markChecks = createMarkChecks({ setups, equipment, clock });
    registerModuleRoutes = (registry) => {
      registerAccountRoutes(registry, {
        ensureProfile,
        updatePreferences,
        setQuickAccess,
        exportData,
        requestDeletion,
        cancelDeletion,
      });
      registerSetupRoutes(registry, {
        shared: createSetupUseCases({ setups, marks: setupMarks, clock, transact, bus }),
        views,
        create: createCreateSetup({ setups, check, clock }),
        update: createUpdateSetup({ setups, marks: setupMarks, check, clock }),
      });
      registerMarkRoutes(registry, {
        shared: createMarkUseCases({ marks, checks: markChecks, clock }),
        create: createCreateMark({ marks, checks: markChecks, clock, transact }),
        update: createUpdateMark({ marks, checks: markChecks, clock, transact }),
      });
      registerBowRoutes(registry, {
        shared: createComponentUseCases({
          repositories: bows,
          usage: usage.bowUsage,
          clock,
          resource: 'bow',
          inUseCode: 'SM-BOW-409-001',
        }),
        create: createCreateBow({ bows, clock }),
        update: createUpdateBow({ bows, clock }),
      });
      registerArrowSetRoutes(registry, {
        shared: createComponentUseCases({
          repositories: arrowSets,
          usage: usage.arrowSetUsage,
          clock,
          resource: 'arrow set',
          inUseCode: 'SM-ARW-409-001',
        }),
        create: createCreateArrowSet({ arrowSets, clock }),
        update: createUpdateArrowSet({ arrowSets, clock }),
      });
      registerSightRoutes(registry, {
        shared: createComponentUseCases({
          repositories: sights,
          usage: usage.sightUsage,
          clock,
          resource: 'sight',
          inUseCode: 'SM-SGT-409-001',
        }),
        create: createCreateSight({ sights, clock }),
        update: createUpdateSight({ sights, marks: sightMarks, clock, transact }),
      });
    };
    // Awaited, so a failure reaches the publisher (which logs it) instead of an unhandled rejection.
    // RN-STP-07: a deleted setup takes its quick access with it. Runs inside the trash transaction.
    bus.on('SetupDeleted', async ({ userId, setupId }) => {
      await clearQuickAccessOfSetup(userId, setupId);
    });
    // RF-ACC-06: when the archer's time is up, every module removes what is theirs for good. The
    // account's own profile is last: a failure halfway leaves it there and the next run finishes.
    bus.on('AccountPurged', async ({ userId }) => {
      await createPurgeEquipment(connection)(userId);
    });
    bus.on('AccountPurged', async ({ userId }) => {
      await createPurgeCalculatorData(connection)(userId);
    });
    bus.on('AccountPurged', async ({ userId }) => {
      await deleteIdentity(connection, userId);
      await deleteAllOf(connection, 'idempotencyKeys', userId);
    });
    bus.on('AccountPurged', async ({ userId }) => {
      await createPurgeProfile(connection)(userId);
    });
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
    scheduler = createScheduler({
      connection,
      clock,
      logger,
      jobs: [purgeIdempotencyKeys, purgeDeletedSetups, createPurgeDeletedAccounts({ bus })],
    });
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
    ifMatchExempt: [...IF_MATCH_EXEMPT, ...(deps.ifMatchExempt ?? [])],
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
