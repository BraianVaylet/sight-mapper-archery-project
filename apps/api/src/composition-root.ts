import { systemClock, type Clock } from './core/clock/clock.js';
import type { Env } from './core/config/env.js';
import { createEventBus, type EventBus } from './core/events/bus.js';
import { createHttpApp, type HttpApp } from './core/http/app.js';
import { alwaysReady, type Readiness } from './core/http/context.js';
import type { Logger } from './core/logger/logger.js';

export type Container = HttpApp & {
  readonly env: Env;
  readonly logger: Logger;
  readonly bus: EventBus;
};

export type ContainerDeps = {
  readonly env: Env;
  readonly logger: Logger;
  readonly clock?: Clock;
  readonly readiness?: Readiness;
};

/**
 * The one place that knows every piece: it wires modules, ports and event listeners so the
 * modules themselves never import each other (ADR-002). Modules plug in here as they land.
 */
export function createContainer(deps: ContainerDeps): Container {
  const { env, logger } = deps;
  const clock = deps.clock ?? systemClock;
  const readiness = deps.readiness ?? alwaysReady;

  const bus = createEventBus();
  const http = createHttpApp({ env, logger, clock, readiness });

  return { ...http, env, logger, bus };
}
