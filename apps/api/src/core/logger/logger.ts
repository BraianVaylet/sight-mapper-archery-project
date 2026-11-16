import { pino, type DestinationStream, type Logger } from 'pino';

export type { Logger };

export type LoggerOptions = {
  readonly level: string;
  /** Human-readable output through pino-pretty. Local development only. */
  readonly pretty?: boolean;
};

/** Never log these, wherever they appear (secrets, sessions, credentials). */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.token',
  '*.secret',
  '*.apiKey',
  'password',
  'newPassword',
  'token',
  'secret',
  'apiKey',
];

/** Structured JSON logs with redaction. `destination` lets tests capture the lines. */
export function createLogger(options: LoggerOptions, destination?: DestinationStream): Logger {
  const base = {
    level: options.level,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    base: { service: 'sight-mapper-api' },
  };

  if (destination !== undefined) return pino(base, destination);
  if (options.pretty === true) {
    return pino({ ...base, transport: { target: 'pino-pretty' } });
  }
  return pino(base);
}
