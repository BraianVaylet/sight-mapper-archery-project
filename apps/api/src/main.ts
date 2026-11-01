import { serve } from '@hono/node-server';
import { createContainer } from './composition-root.js';
import { EnvError, parseEnv } from './core/config/env.js';
import { systemClock } from './core/clock/clock.js';
import { connectMongo, mongoReadiness } from './core/db/connection.js';
import { createMongoIdempotencyStore } from './core/idempotency/mongo-store.js';
import { createLogger } from './core/logger/logger.js';

async function start(): Promise<void> {
  let env;
  try {
    env = parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  const logger = createLogger({
    level: env.LOG_LEVEL,
    pretty: env.NODE_ENV === 'development' && env.APP_ENV === 'local',
  });
  const connection = await connectMongo(env.MONGODB_URI, logger);
  const { app, scheduler } = createContainer({
    env,
    logger,
    connection,
    readiness: mongoReadiness(connection),
    idempotencyStore: createMongoIdempotencyStore(connection, systemClock),
    ifMatchExempt: ['DELETE /api/v1/me/deletion-request'],
  });

  scheduler?.start();

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port, appEnv: env.APP_ENV }, 'api listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    scheduler?.stop();
    server.close(() => {
      void connection.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to start: ${reason}\n`);
  process.exit(1);
});
