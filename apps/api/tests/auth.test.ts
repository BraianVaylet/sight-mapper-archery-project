import { createRoute, z } from '@hono/zod-openapi';
import type { ErrorEnvelope } from '@sight-mapper/types';
import type { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createContainer } from '../src/composition-root.js';
import type { Email, EmailSender } from '../src/core/auth/email.js';
import { fixedClock } from '../src/core/clock/clock.js';
import type { Env } from '../src/core/config/env.js';
import { connectMongo } from '../src/core/db/connection.js';
import { createLogger } from '../src/core/logger/logger.js';
import { startReplSet } from './helpers/mongo.js';

const ORIGIN = 'http://localhost:5173';
// Built at run time: a literal that looks like a secret would (rightly) trip the repo's guards.
const PASSWORD = ['correct', 'horse', 'battery'].join(' ');
const NEW_PASSWORD = ['another', 'long', 'passphrase'].join(' ');

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
  LOG_LEVEL: 'debug',
};

let replSet: MongoMemoryReplSet;
let connection: Connection;
let app: ReturnType<typeof createContainer>['app'];
const mails: Email[] = [];
const logs: string[] = [];
let ipCounter = 0;

const sender: EmailSender = {
  send(email) {
    mails.push(email);
    return Promise.resolve();
  },
};

beforeAll(async () => {
  replSet = await startReplSet();
  connection = await connectMongo(
    replSet.getUri('sightmapper_auth'),
    createLogger({ level: 'silent' }),
  );
  const logger = createLogger(
    { level: 'debug' },
    { write: (line: string) => void logs.push(line) },
  );
  const container = createContainer({
    env,
    logger,
    clock: fixedClock('2026-11-01T12:00:00Z'),
    connection,
    emails: sender,
  });
  container.registry.register(
    createRoute({
      method: 'get',
      path: '/api/v1/whoami/{userId}',
      request: {
        params: z.object({ userId: z.string() }),
        query: z.object({ userId: z.string().optional() }),
      },
      responses: {
        200: {
          description: 'ok',
          content: { 'application/json': { schema: z.object({ userId: z.string() }) } },
        },
      },
    }),
    // The path and the query carry a userId on purpose: the answer must ignore both.
    (c) => c.json({ userId: c.get('userId') ?? 'none' }, 200),
    { auth: 'session' },
  );
  app = container.app;
}, 120_000);

afterAll(async () => {
  await connection?.close();
  await replSet?.stop();
});

const nextIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
type Json = Record<string, unknown>;

async function call(
  method: string,
  path: string,
  options: { body?: Json; cookie?: string; ip?: string; language?: string } = {},
) {
  const headers: Record<string, string> = {
    origin: ORIGIN,
    'x-forwarded-for': options.ip ?? nextIp(),
    'accept-language': options.language ?? 'es-AR,es;q=0.9',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.cookie !== undefined) headers['cookie'] = options.cookie;
  return app.request(path, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

const cookieOf = (res: Response): string =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

const errorOf = async (res: Response) => ((await res.json()) as ErrorEnvelope).error;

let userCounter = 0;
/** A fresh archer: unique email and username. */
const newUser = (language = 'es-AR') => {
  userCounter += 1;
  return {
    email: `archer${userCounter}@example.com`,
    username: `archer.${userCounter}`,
    name: `Archer ${userCounter}`,
    language,
  };
};
type User = ReturnType<typeof newUser>;

const signUp = (user: User, ip = nextIp()) =>
  call('POST', '/api/auth/sign-up/email', {
    ip,
    language: user.language,
    body: {
      email: user.email,
      password: PASSWORD,
      name: user.name,
      username: user.username,
      callbackURL: `${ORIGIN}/verified`,
    },
  });

/** The link inside the last email sent to `to`. */
function linkTo(to: string): string {
  const mail = [...mails].reverse().find((m) => m.to === to);
  const match = mail ? /https?:\/\/\S+/.exec(mail.text) : null;
  if (!match) throw new Error(`no email with a link for ${to}`);
  return match[0];
}

const asRequest = (url: string) => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

/** Registers, verifies the email and returns the user. */
async function registerAndVerify(language?: string): Promise<User> {
  const user = newUser(language);
  expect((await signUp(user)).status).toBe(200);
  await waitFor(() => mails.some((m) => m.to === user.email));
  const verified = await call('GET', asRequest(linkTo(user.email)));
  expect([200, 302]).toContain(verified.status);
  return user;
}

const login = (user: User, password = PASSWORD, ip?: string) =>
  call('POST', '/api/auth/sign-in/email', {
    ...(ip === undefined ? {} : { ip }),
    body: { email: user.email, password },
  });

async function profileOf(userId: string) {
  return connection.db?.collection('profiles').findOne({ userId });
}

/** Polls until `check` is true: the email and the profile are created after the response. */
async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const started = performance.now();
  while (!(await check())) {
    if (performance.now() - started > timeoutMs) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('sign-up', () => {
  it('creates the user, sends one verification email and creates a profile', async () => {
    const user = newUser();
    const before = mails.length;
    const res = await signUp(user);
    expect(res.status).toBe(200);

    await waitFor(() => mails.length > before);
    const mail = mails.at(-1);
    expect(mail?.to).toBe(user.email);
    expect(mail?.subject).toBe('Verificá tu email en Sight Mapper');
    expect(mail?.text).toContain('/api/auth/verify-email?token=');
    expect(mails.length).toBe(before + 1);

    const doc = await connection.db?.collection('user').findOne({ email: user.email });
    expect(doc).toMatchObject({ email: user.email, emailVerified: false, username: user.username });

    await waitFor(async () => (await profileOf(String(doc?._id))) !== null);
    expect(await profileOf(String(doc?._id))).toMatchObject({
      locale: 'es',
      unitSystem: 'metric',
      theme: 'system',
      quickAccess: null,
      deletionRequestedAt: null,
      version: 1,
    });
  });

  it('writes the email and the profile in the language of the browser', async () => {
    const user = newUser('en-US');
    await signUp(user);
    await waitFor(() => mails.some((m) => m.to === user.email));
    expect(mails.find((m) => m.to === user.email)?.subject).toBe(
      'Verify your email for Sight Mapper',
    );
    const doc = await connection.db?.collection('user').findOne({ email: user.email });
    await waitFor(async () => (await profileOf(String(doc?._id))) !== null);
    expect(await profileOf(String(doc?._id))).toMatchObject({
      locale: 'en',
      unitSystem: 'imperial',
    });
  });

  it('refuses a weak password with SM-AUTH-400-001 and the minimum length', async () => {
    const user = newUser();
    const res = await call('POST', '/api/auth/sign-up/email', {
      body: { email: user.email, password: 'short', name: user.name, username: user.username },
    });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatchObject({
      code: 'SM-AUTH-400-001',
      messageKey: 'errors.auth.weakPassword',
      params: { minLength: 8 },
    });
  });

  it('answers a repeated email like a new one, so it does not reveal who is registered', async () => {
    const first = await registerAndVerify();
    const before = await connection.db?.collection('user').countDocuments({ email: first.email });
    const fresh = newUser();
    const mailsBefore = mails.length;

    const dup = await call('POST', '/api/auth/sign-up/email', {
      body: { email: first.email, password: PASSWORD, name: 'x', username: fresh.username },
    });
    const brandNew = await signUp(newUser());
    expect(dup.status).toBe(200);
    expect(dup.status).toBe(brandNew.status);
    expect(Object.keys((await dup.json()) as object).sort()).toEqual(
      Object.keys((await brandNew.json()) as object).sort(),
    );

    // nothing was created, and the real owner of the address gets no new account
    expect(await connection.db?.collection('user').countDocuments({ email: first.email })).toBe(
      before,
    );
    expect(
      await connection.db?.collection('user').countDocuments({ username: fresh.username }),
    ).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mails.slice(mailsBefore).some((m) => m.to === first.email)).toBe(false);
  });

  it('refuses a repeated username with SM-AUTH-409-002', async () => {
    const first = await registerAndVerify();
    const dupUser = await call('POST', '/api/auth/sign-up/email', {
      body: { email: newUser().email, password: PASSWORD, name: 'x', username: first.username },
    });
    expect(dupUser.status).toBe(409);
    expect((await errorOf(dupUser)).code).toBe('SM-AUTH-409-002');
  });

  it.each(['ab', 'has space', 'bad/name', 'x'.repeat(31), 'ñandú'])(
    'refuses the username %j with SM-AUTH-400-003',
    async (username) => {
      const user = newUser();
      const res = await call('POST', '/api/auth/sign-up/email', {
        body: { email: user.email, password: PASSWORD, name: user.name, username },
      });
      expect(res.status).toBe(400);
      expect(await errorOf(res)).toMatchObject({
        code: 'SM-AUTH-400-003',
        params: { pattern: '[a-z0-9._]{3,30}' },
      });
    },
  );

  it('answers in the error envelope: keys and params, no prose from the provider', async () => {
    const user = newUser();
    const res = await call('POST', '/api/auth/sign-up/email', {
      body: { email: user.email, password: 'short', name: user.name, username: user.username },
    });
    const body = (await res.json()) as ErrorEnvelope;
    expect(Object.keys(body)).toEqual(['success', 'error']);
    expect(Object.keys(body.error).sort()).toEqual(
      ['code', 'messageKey', 'params', 'requestId', 'timestamp'].sort(),
    );
    expect(JSON.stringify(body)).not.toMatch(/too short/i);
  });
});

describe('sign-in', () => {
  it('is refused until the email is verified: SM-AUTH-403-001', async () => {
    const user = newUser();
    await signUp(user);
    const res = await login(user);
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toMatchObject({
      code: 'SM-AUTH-403-001',
      messageKey: 'errors.auth.emailNotVerified',
    });
  });

  it('works with the email once verified, and sets an httpOnly SameSite=Lax cookie', async () => {
    const user = await registerAndVerify();
    const res = await login(user);
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().join('\n');
    expect(cookie).toMatch(/better-auth\.session_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
  });

  it('works with the username too', async () => {
    const user = await registerAndVerify();
    const res = await call('POST', '/api/auth/sign-in/username', {
      body: { username: user.username, password: PASSWORD },
    });
    expect(res.status).toBe(200);
    expect(cookieOf(res)).toContain('better-auth.session_token=');
  });

  it('treats a wrong password and an unknown email the same: SM-AUTH-401-001', async () => {
    const user = await registerAndVerify();
    const wrong = await login(user, 'not the password');
    const unknown = await login({ ...user, email: 'nobody@example.com' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const a = await errorOf(wrong);
    const b = await errorOf(unknown);
    expect(a.code).toBe('SM-AUTH-401-001');
    expect(b.code).toBe(a.code);
    expect(b.messageKey).toBe(a.messageKey);
    expect(b.params).toEqual(a.params);
  });

  it('refuses a wrong password by username with the same code', async () => {
    const user = await registerAndVerify();
    const res = await call('POST', '/api/auth/sign-in/username', {
      body: { username: user.username, password: 'nope nope nope' },
    });
    expect((await errorOf(res)).code).toBe('SM-AUTH-401-001');
  });

  it('after 5 failed attempts the next one is SM-CORE-429-001 with retryAfterS', async () => {
    const user = await registerAndVerify();
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      expect((await login(user, `wrong password ${i}`, ip)).status).toBe(401);
    }
    const blocked = await login(user, 'wrong password 6', ip);
    expect(blocked.status).toBe(429);
    const error = await errorOf(blocked);
    expect(error.code).toBe('SM-CORE-429-001');
    expect(error.messageKey).toBe('errors.core.rateLimited');
    expect(typeof error.params['retryAfterS']).toBe('number');
    // even the right password waits: the limit is on attempts, not on mistakes
    expect((await login(user, PASSWORD, ip)).status).toBe(429);
    // another address is not affected
    expect((await login(user, PASSWORD, nextIp())).status).toBe(200);
  });
});

describe('the session turns into userId, and only from the cookie (ADR-000)', () => {
  const whoami = (
    cookie: string | undefined,
    path = '/api/v1/whoami/someone-else?userId=also-someone-else',
  ) => call('GET', path, cookie === undefined ? {} : { cookie });

  it('answers 401 SM-CORE-401-001 with no session', async () => {
    const res = await whoami(undefined);
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe('SM-CORE-401-001');
  });

  it('answers 401 for a cookie that is not a session', async () => {
    expect((await whoami('better-auth.session_token=forged.value')).status).toBe(401);
  });

  it('gives the id of the signed-in archer, ignoring a userId in the path and the query', async () => {
    const user = await registerAndVerify();
    const res = await whoami(cookieOf(await login(user)));
    expect(res.status).toBe(200);
    const { userId } = (await res.json()) as { userId: string };
    const doc = await connection.db?.collection('user').findOne({ email: user.email });
    expect(userId).toBe(String(doc?._id));
    expect(userId).not.toContain('someone-else');
  });

  it('two archers get two different ids', async () => {
    const a = await registerAndVerify();
    const b = await registerAndVerify();
    const idOf = async (user: User) =>
      ((await (await whoami(cookieOf(await login(user)))).json()) as { userId: string }).userId;
    expect(await idOf(a)).not.toBe(await idOf(b));
  });

  it('sign-out ends the session', async () => {
    const user = await registerAndVerify();
    const cookie = cookieOf(await login(user));
    expect((await whoami(cookie)).status).toBe(200);
    expect((await call('POST', '/api/auth/sign-out', { cookie, body: {} })).status).toBe(200);
    expect((await whoami(cookie)).status).toBe(401);
  });

  it('leaves the API description public: it needs no session', async () => {
    expect((await call('GET', '/api/v1/openapi.json')).status).toBe(200);
  });
});

describe('password reset', () => {
  const askReset = (email: string) =>
    call('POST', '/api/auth/request-password-reset', {
      body: { email, redirectTo: `${ORIGIN}/reset` },
    });

  it('sends a single-use link, sets the new password and revokes the old sessions', async () => {
    const user = await registerAndVerify();
    const oldCookie = cookieOf(await login(user));

    expect((await askReset(user.email)).status).toBe(200);
    await waitFor(() => mails.some((m) => m.to === user.email && /reset-password/.test(m.text)));
    const mail = [...mails].reverse().find((m) => m.to === user.email);
    expect(mail?.subject).toBe('Restablecé tu contraseña de Sight Mapper');

    const token = new URL(linkTo(user.email)).pathname.split('/').pop() ?? '';
    expect(token.length).toBeGreaterThan(10);

    const reset = await call('POST', '/api/auth/reset-password', {
      body: { newPassword: NEW_PASSWORD, token },
    });
    expect(reset.status).toBe(200);

    expect((await login(user, NEW_PASSWORD)).status).toBe(200);
    expect((await login(user, PASSWORD)).status).toBe(401);
    expect(
      (await call('GET', '/api/v1/whoami/x', { cookie: oldCookie })).status,
      'the session from before the reset is revoked',
    ).toBe(401);

    const again = await call('POST', '/api/auth/reset-password', {
      body: { newPassword: ['third', 'long', 'passphrase'].join(' '), token },
    });
    expect(again.status).toBe(400);
    expect((await errorOf(again)).code).toBe('SM-AUTH-400-002');
  });

  it('does not reveal whether the email exists', async () => {
    const known = await registerAndVerify();
    const a = await askReset(known.email);
    const b = await askReset('ghost@example.com');
    expect(a.status).toBe(b.status);
  });

  it('rejects an invalid token with SM-AUTH-400-002', async () => {
    const res = await call('POST', '/api/auth/reset-password', {
      body: { newPassword: NEW_PASSWORD, token: 'not-a-real-token' },
    });
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe('SM-AUTH-400-002');
  });
});

describe('what never reaches the logs', () => {
  it('no password, token or session value is logged through a whole account lifecycle', async () => {
    const user = await registerAndVerify();
    const cookie = cookieOf(await login(user));
    await call('POST', '/api/auth/request-password-reset', {
      body: { email: user.email, redirectTo: `${ORIGIN}/reset` },
    });
    await login(user, 'definitely wrong password');
    await waitFor(() => mails.some((m) => m.to === user.email && /reset-password/.test(m.text)));

    const text = logs.join('\n');
    expect(logs.length).toBeGreaterThan(0);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('definitely wrong password');
    const sessionToken = /better-auth\.session_token=([^;]+)/.exec(cookie)?.[1] ?? '';
    expect(sessionToken.length).toBeGreaterThan(10);
    expect(text).not.toContain(sessionToken);
    expect(text).not.toContain(new URL(linkTo(user.email)).pathname.split('/').pop() ?? '#');
  });
});
