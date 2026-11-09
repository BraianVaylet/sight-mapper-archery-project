import { detectLocale } from '@sight-mapper/i18n';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { username } from 'better-auth/plugins';
import type { Env } from '../config/env.js';
import type { DbConnection } from '../db/connection.js';
import type { EventBus } from '../events/bus.js';
import type { Logger } from '../logger/logger.js';
import { renderAuthEmail, type AuthEmailKind, type EmailSender } from './email.js';
import { MIN_PASSWORD_LENGTH } from './errors.js';
import type { SessionReader } from './session.js';

export const AUTH_BASE_PATH = '/api/auth';

/**
 * Attempts allowed per IP in 15 minutes on the endpoints that can be guessed or abused. Only on a
 * laptop (`pnpm dev:local`: `APP_ENV=local`, not under test) the cap is lifted: the E2E suite signs
 * up a new archer per test from one address. Every hosted environment and every API test keeps the
 * real limit.
 */
export function sensitiveLimit(env: Pick<Env, 'APP_ENV' | 'NODE_ENV'>): {
  window: number;
  max: number;
} {
  return { window: 15 * 60, max: onLaptop(env) ? 1000 : 5 };
}

/**
 * Requests per IP per minute on every auth endpoint (`get-session` included). On a laptop the
 * E2E suite walks every screen many times from one address and would run into it; anywhere else,
 * and under test, it stays at 100.
 */
export function globalLimit(env: Pick<Env, 'APP_ENV' | 'NODE_ENV'>): {
  window: number;
  max: number;
} {
  return { window: 60, max: onLaptop(env) ? 10_000 : 100 };
}

/** `pnpm dev:local` on a laptop: the only place where the limits are lifted. */
const onLaptop = (env: Pick<Env, 'APP_ENV' | 'NODE_ENV'>) =>
  env.APP_ENV === 'local' && env.NODE_ENV !== 'test';
const HOUR_S = 60 * 60;

export type AuthDeps = {
  readonly env: Env;
  readonly connection: DbConnection;
  readonly emails: EmailSender;
  readonly bus: EventBus;
  readonly logger: Logger;
};

export type AuthModule = {
  /** Better Auth's fetch handler, mounted on `/api/auth/*`. */
  readonly handler: (request: Request) => Promise<Response>;
  readonly sessions: SessionReader;
};

/**
 * Identity (ADR-007): email + password with the `username` plugin, verification required before
 * a session exists, single-use reset links, sessions in an httpOnly cookie. Google is on only
 * when both its variables are set.
 */
export function createAuth(deps: AuthDeps): AuthModule {
  const { env, connection, emails, bus, logger } = deps;
  const client = connection.getClient();
  const secureCookies = env.APP_ENV !== 'local';
  const SENSITIVE = sensitiveLimit(env);

  // Sending is not awaited: a slow mail server must not tell an attacker which addresses exist.
  // A failure is logged, and the archer can ask for the email again.
  const sendInBackground = (
    kind: AuthEmailKind,
    user: { email: string; name: string },
    url: string,
    request: Request | undefined,
  ): void => {
    const locale = detectLocale(parseLanguages(request?.headers.get('accept-language')));
    const email = renderAuthEmail(kind, locale, { name: user.name, url, to: user.email });
    emails.send(email).catch((error: unknown) => {
      logger.error({ err: error, kind }, 'auth email failed');
    });
  };

  const auth = betterAuth({
    appName: 'Sight Mapper',
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.CORS_ORIGINS,
    // Better Auth logs to the console by default, and its info lines carry email addresses. Route it
    // through our redacting logger and keep only warnings and errors.
    logger: {
      level: 'warn',
      log: (level, message) => {
        logger[level === 'warn' ? 'warn' : 'error']({ source: 'better-auth' }, message);
      },
    },
    database: mongodbAdapter(client.db(), { client, transaction: true }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: HOUR_S,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }, request) => {
        sendInBackground('reset', user, url, request);
        return Promise.resolve();
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: HOUR_S,
      sendVerificationEmail: ({ user, url }, request) => {
        sendInBackground('verify', user, url, request);
        return Promise.resolve();
      },
    },

    ...(env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
      ? {
          socialProviders: {
            google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
          },
        }
      : {}),

    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator: (value) => /^[a-z0-9._]+$/.test(value),
      }),
    ],

    rateLimit: {
      enabled: true,
      ...globalLimit(env),
      customRules: {
        '/sign-in/email': SENSITIVE,
        '/sign-in/username': SENSITIVE,
        '/sign-up/email': SENSITIVE,
        '/request-password-reset': SENSITIVE,
        '/reset-password': SENSITIVE,
        '/send-verification-email': SENSITIVE,
      },
    },

    advanced: {
      // Behind Railway's proxy the caller's address is in X-Forwarded-For.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      useSecureCookies: secureCookies,
      defaultCookieAttributes: { httpOnly: true, secure: secureCookies, sameSite: 'lax' },
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user, context) => {
            // The user exists even if the reaction fails: the profile is created again, lazily,
            // the first time it is needed (`ensureProfile` is idempotent).
            try {
              const locale = detectLocale(
                parseLanguages(context?.request?.headers.get('accept-language')),
              );
              await bus.publish('UserRegistered', { userId: user.id, locale });
            } catch (error) {
              logger.error({ err: error, userId: user.id }, 'UserRegistered handler failed');
            }
          },
        },
      },
    },
  });

  return {
    handler: (request) => auth.handler(request),
    sessions: {
      getSession: (headers) => auth.api.getSession({ headers }),
    },
  };
}

/** `es-AR,es;q=0.9,en;q=0.8` to `['es-AR', 'es', 'en']`, best first. */
export function parseLanguages(header: string | null | undefined): string[] {
  if (header === null || header === undefined) return [];
  return header
    .split(',')
    .map((part) => part.split(';')[0]?.trim() ?? '')
    .filter((tag) => tag !== '' && tag !== '*');
}
