import { z } from 'zod';

/** Empty strings (`GOOGLE_CLIENT_ID=` copied from .env.example) mean "not set". */
const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value));

/**
 * Validated at startup: if a variable is missing or malformed the process does not start
 * (TECNICO §2). Secrets are never echoed in the error.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'staging', 'prod']).default('local'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    MONGODB_URI: z.string().min(1),
    /** Signs and encrypts sessions and tokens: 32+ characters of randomness. */
    BETTER_AUTH_SECRET: z.string().min(32),
    /** Public URL of this API: where verification and reset links point. */
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    RESEND_API_KEY: optionalText,
    EMAIL_FROM: optionalText,
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      )
      .refine(
        (origins) => !origins.includes('*'),
        'CORS_ORIGINS must list explicit origins, no wildcard',
      ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((env, ctx) => {
    if ((env.GOOGLE_CLIENT_ID === undefined) !== (env.GOOGLE_CLIENT_SECRET === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_ID'],
        message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET go together',
      });
    }
    // Locally the verification link is logged; anywhere else real mail must go out.
    if (env.APP_ENV !== 'local') {
      for (const name of ['RESEND_API_KEY', 'EMAIL_FROM'] as const) {
        if (env[name] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: `${name} is required outside local`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

/** Reads the environment. Reports every problem at once, never a secret value. */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  throw new EnvError(
    result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
  );
}
