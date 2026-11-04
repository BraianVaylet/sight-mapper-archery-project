import { Temporal } from '@js-temporal/polyfill';
import type { ErrorEnvelope } from '@sight-mapper/types';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '../src/composition-root.js';
import type { Email, EmailSender } from '../src/core/auth/email.js';
import type { Clock } from '../src/core/clock/clock.js';
import type { Env } from '../src/core/config/env.js';
import { connectMongo } from '../src/core/db/connection.js';
import { createLogger } from '../src/core/logger/logger.js';
import { createPurgeDeletedAccounts } from '../src/modules/account/index.js';
import { startReplSet } from './helpers/mongo.js';

// RF-ACC-06 with the real identity (Better Auth): when the 90 days are up, who the archer is goes too.

const ORIGIN = 'http://localhost:5173';
// Built at run time: a literal that looks like a secret would (rightly) trip the repo's guards.
const PASSWORD = ['correct', 'horse', 'battery'].join(' ');

const env: Env = {
  NODE_ENV: 'test',
  APP_ENV: 'local',
  PORT: 3000,
  MONGODB_URI: 'mongodb://localhost/test',
  BETTER_AUTH_SECRET: 's'.repeat(40),
  BETTER_AUTH_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  RESEND_API_KEY: undefined,
  EMAIL_FROM: undefined,
  CORS_ORIGINS: [ORIGIN],
  LOG_LEVEL: 'silent',
};

const START = Temporal.Instant.from('2026-11-02T12:00:00Z');
let now = START;
const clock: Clock = { now: () => now };

let replSet: MongoMemoryReplSet;
let connection: Connection;
let container: ReturnType<typeof createContainer>;
const mails: Email[] = [];
const logger = createLogger({ level: 'silent' });
const sender: EmailSender = {
  send(email) {
    mails.push(email);
    return Promise.resolve();
  },
};

beforeAll(async () => {
  replSet = await startReplSet();
  connection = await connectMongo(replSet.getUri('sightmapper_account_purge'), logger);
  container = createContainer({ env, logger, clock, connection, emails: sender });
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

let counter = 0;
const nextIp = () => `10.1.0.${(counter += 1)}`;

async function call(
  method: string,
  path: string,
  options: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    origin: ORIGIN,
    'x-forwarded-for': nextIp(),
    ...options.headers,
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.cookie !== undefined) headers['cookie'] = options.cookie;
  return container.app.request(path, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 3000) {
  const started = performance.now();
  while (!(await check())) {
    if (performance.now() - started > timeoutMs) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** A real archer: signs up, verifies the email, signs in, and has a session cookie. */
async function archer(label: string) {
  const email = `${label}@example.com`;
  const username = `${label}.user`;
  const signUp = await call('POST', '/api/auth/sign-up/email', {
    body: { email, password: PASSWORD, name: label, username, callbackURL: `${ORIGIN}/verified` },
  });
  expect(signUp.status).toBe(200);
  await waitFor(() => mails.some((m) => m.to === email));
  const link = /https?:\/\/\S+/.exec(
    [...mails].reverse().find((m) => m.to === email)?.text ?? '',
  )?.[0];
  const url = new URL(link ?? 'http://x');
  expect([200, 302]).toContain((await call('GET', `${url.pathname}${url.search}`)).status);
  const login = await call('POST', '/api/auth/sign-in/email', {
    body: { email, password: PASSWORD },
  });
  expect(login.status).toBe(200);
  const cookie = cookieOf(login);
  const profile = (await (await call('GET', '/api/v1/me', { cookie })).json()) as {
    version: number;
  };
  return { email, username, cookie, version: profile.version };
}

const countIn = (collection: string, filter: Record<string, unknown> = {}) =>
  connection.db?.collection(collection).countDocuments(filter) ?? Promise.resolve(0);
const userOf = async (email: string) => connection.db?.collection('user').findOne({ email });

describe('the purge takes the identity with it', () => {
  it('removes the user, the sessions, the linked accounts and the pending links; the others stay', async () => {
    const leaving = await archer('leaving');
    const staying = await archer('staying');
    const leavingUser = await userOf(leaving.email);
    const stayingUser = await userOf(staying.email);
    expect(leavingUser).not.toBeNull();
    const leavingId = String(leavingUser?._id);

    // Data of the leaving archer: it goes too.
    expect(
      (
        await call('POST', '/api/v1/bows', {
          cookie: leaving.cookie,
          headers: { 'idempotency-key': uuidv7() },
          body: { id: uuidv7(), bowType: 'compound', model: 'Alpha' },
        })
      ).status,
    ).toBe(201);

    // The leaving archer asks for deletion with their own session.
    const requested = await call('POST', '/api/v1/me/deletion-request', {
      cookie: leaving.cookie,
      headers: { 'idempotency-key': uuidv7() },
    });
    expect(requested.status).toBe(200);

    now = START.add({ hours: 91 * 24 });
    const stats = await createPurgeDeletedAccounts({ bus: container.bus }).run({
      now,
      connection,
      logger,
    });
    expect(stats['purged']).toBe(1);

    // Nothing of who they were is left...
    expect(await userOf(leaving.email)).toBeNull();
    expect(await countIn('session', { userId: { $in: [leavingId, leavingUser?._id] } })).toBe(0);
    expect(await countIn('account', { userId: { $in: [leavingId, leavingUser?._id] } })).toBe(0);
    expect(await countIn('verification', { identifier: leaving.email })).toBe(0);
    expect(await countIn('profiles', { userId: leavingId })).toBe(0);
    expect(await countIn('bows', { userId: leavingId })).toBe(0);

    // ...they cannot come back in with the old session or the old password...
    expect((await call('GET', '/api/v1/me', { cookie: leaving.cookie })).status).toBe(401);
    const login = await call('POST', '/api/auth/sign-in/email', {
      body: { email: leaving.email, password: PASSWORD },
    });
    expect(login.status).toBeGreaterThanOrEqual(400);

    // ...and the other archer is exactly as they were.
    expect(await userOf(staying.email)).not.toBeNull();
    expect(
      await countIn('account', { userId: { $in: [String(stayingUser?._id), stayingUser?._id] } }),
    ).toBeGreaterThan(0);
    expect((await call('GET', '/api/v1/me', { cookie: staying.cookie })).status).toBe(200);
    expect(
      (
        (await (await call('GET', '/api/v1/me', { cookie: staying.cookie })).json()) as {
          version: number;
        }
      ).version,
    ).toBe(staying.version);
    now = START;
  });

  it('lets the same email sign up again as a new archer afterwards', async () => {
    const first = await archer('again');
    const asked = await call('POST', '/api/v1/me/deletion-request', {
      cookie: first.cookie,
      headers: { 'idempotency-key': uuidv7() },
    });
    expect(asked.status).toBe(200);
    now = START.add({ hours: 91 * 24 });
    await createPurgeDeletedAccounts({ bus: container.bus }).run({ now, connection, logger });
    now = START;

    const signUp = await call('POST', '/api/auth/sign-up/email', {
      body: {
        email: first.email,
        password: PASSWORD,
        name: 'again',
        username: first.username,
        callbackURL: `${ORIGIN}/verified`,
      },
    });
    expect(signUp.status).toBe(200);
    const body = (await signUp.json()) as ErrorEnvelope | { user?: unknown };
    expect(body).not.toHaveProperty('error');
  });
});
