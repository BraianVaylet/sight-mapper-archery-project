import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { toValidationIssues } from '@sight-mapper/schemas';
import type { ValidationIssue } from '@sight-mapper/types';
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { v7 as uuidv7 } from 'uuid';
import { ifMatchGuard } from '../concurrency/concurrency.js';
import { idempotency, type IdempotencyStore } from '../idempotency/idempotency.js';
import type { Clock } from '../clock/clock.js';
import type { Env } from '../config/env.js';
import type { Logger } from '../logger/logger.js';
import { createRouteRegistry, type RouteRegistry } from '../registry/registry.js';
import type { AppBindings, Readiness } from './context.js';
import { AppError, toEnvelope } from './errors.js';

export const MAX_BODY_BYTES = 64 * 1024;

export type HttpDeps = {
  readonly env: Pick<Env, 'APP_ENV' | 'CORS_ORIGINS'>;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly readiness: Readiness;
  /** Sets `userId` from the session cookie on `/api/v1/*` (F0-15). */
  readonly session?: MiddlewareHandler<AppBindings>;
  /** Backs `Idempotency-Key` on every POST under `/api/v1`. */
  readonly idempotencyStore?: IdempotencyStore;
  /** `METHOD path` pairs that change state without a versioned resource, so need no `If-Match`. */
  readonly ifMatchExempt?: readonly string[];
};

export type HttpApp = {
  readonly app: OpenAPIHono<AppBindings>;
  readonly registry: RouteRegistry;
};

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const uuid = z.uuid();

const okSchema = z.object({ status: z.literal('ok') });
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      description: 'The process is alive',
      content: { 'application/json': { schema: okSchema } },
    },
  },
});
const readyRoute = createRoute({
  method: 'get',
  path: '/ready',
  responses: {
    200: {
      description: 'Alive and every dependency answers',
      content: { 'application/json': { schema: okSchema } },
    },
  },
});

export function createHttpApp(deps: HttpDeps): HttpApp {
  const { env, logger, clock, readiness, session, idempotencyStore, ifMatchExempt } = deps;

  const app = new OpenAPIHono<AppBindings>({
    // Zod failures on any route become SM-CORE-400-001 with one issue per field.
    defaultHook: (result) => {
      if (result.success) return;
      const issues = toValidationIssues(result.error);
      const [only] = issues;
      // A lone malformed id is its own error, so the client can tell it from a bad form.
      if (issues.length === 1 && only !== undefined && isMalformedId(only)) {
        throw new AppError('SM-CORE-400-002', { field: only.path.join('.') });
      }
      throw new AppError('SM-CORE-400-001', { issues });
    },
  });

  const fail = (c: Context<AppBindings>, error: AppError) =>
    c.json(
      toEnvelope(error, c.get('requestId'), clock.now().toString()),
      error.status as ContentfulStatusCode,
    );

  // 1. Request id: the caller's if it is a valid UUID, otherwise a fresh one.
  app.use(async (c, next) => {
    const incoming = c.req.header('X-Request-Id');
    const requestId =
      incoming !== undefined && uuid.safeParse(incoming).success ? incoming : uuidv7();
    c.set('requestId', requestId);
    c.set('logger', logger.child({ requestId }));
    c.header('X-Request-Id', requestId);
    await next();
  });

  // 2. One structured line per request.
  app.use(async (c, next) => {
    const started = process.hrtime.bigint();
    await next();
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const quiet = c.req.path === '/health' || c.req.path === '/ready';
    c.get('logger')[quiet ? 'debug' : 'info'](
      { method: c.req.method, path: c.req.path, status: c.res.status, durationMs },
      'request',
    );
  });

  app.use(secureHeaders());

  app.use(
    cors({
      origin: (origin) => (env.CORS_ORIGINS.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Idempotency-Key', 'If-Match', 'X-Request-Id'],
      exposeHeaders: ['ETag', 'X-Request-Id'],
      maxAge: 600,
    }),
  );

  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => fail(c, new AppError('SM-CORE-413-001', { maxBytes: MAX_BODY_BYTES })),
    }),
  );

  // Only JSON in: a body of any other type is rejected before a route sees it.
  app.use(async (c, next) => {
    // `raw.body` is null when the request carries no body, however it was framed.
    const hasBody = c.req.raw.body !== null;
    const isJson = (c.req.header('content-type') ?? '')
      .toLowerCase()
      .startsWith('application/json');
    if (BODY_METHODS.has(c.req.method) && hasBody && !isJson) {
      throw new AppError('SM-CORE-415-001');
    }
    await next();
  });

  // Under /api/v1: who is calling, then retry safety (POST), then stale-write safety (PATCH/DELETE).
  if (session !== undefined) app.use('/api/v1/*', session);
  if (idempotencyStore !== undefined) {
    app.use('/api/v1/*', idempotency({ store: idempotencyStore, clock }));
  }
  app.use('/api/v1/*', ifMatchGuard(ifMatchExempt));

  const registry = createRouteRegistry(app);
  registry.register(healthRoute, (c) => c.json({ status: 'ok' as const }, 200), { auth: 'public' });
  registry.register(
    readyRoute,
    async (c) => {
      try {
        await readiness.check();
      } catch (cause) {
        throw new AppError('SM-CORE-503-001', {}, { cause });
      }
      return c.json({ status: 'ok' as const }, 200);
    },
    { auth: 'public' },
  );

  // The API description is not public in production (TECNICO §4).
  if (env.APP_ENV !== 'prod') {
    app.doc('/api/v1/openapi.json', {
      openapi: '3.1.0',
      info: { title: 'Sight Mapper API', version: '0.0.0' },
    });
  }

  app.notFound((c) => fail(c, new AppError('SM-CORE-404-001')));

  app.onError((error, c) => {
    const known = toAppError(error);
    const log = c.get('logger');
    if (known.status >= 500) {
      // The only place a stack is written; it never reaches the response.
      log.error({ err: error, code: known.code }, 'request failed');
    } else if (known.status === 401 || known.status === 404) {
      log.info({ code: known.code }, 'request rejected');
    } else {
      log.warn({ code: known.code }, 'request rejected');
    }
    return fail(c, known);
  });

  return { app, registry };
}

/** A uuid-format failure on `id`, `fooId` or an element of `fooIds`. */
function isMalformedId(issue: ValidationIssue): boolean {
  if (issue.messageKey !== 'validation.invalid_format' || issue.params['format'] !== 'uuid') {
    return false;
  }
  const field = [...issue.path].reverse().find((segment) => typeof segment === 'string');
  return typeof field === 'string' && /^(id|.+Ids?)$/.test(field);
}

function toAppError(error: Error): AppError {
  if (error instanceof AppError) return error;
  // Malformed JSON is the only HTTPException a client can provoke.
  if (error instanceof HTTPException && error.status === 400) {
    return new AppError('SM-CORE-400-001', { issues: [] }, { cause: error });
  }
  return new AppError('SM-CORE-500-001', {}, { cause: error });
}
