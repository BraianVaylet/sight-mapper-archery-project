import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../http/context.js';
import { AppError } from '../http/errors.js';
import { parseLanguages } from './auth.js';
import { sessionMiddleware } from './session.js';

function build(getSession: (h: Headers) => Promise<{ user: { id: string } } | null>) {
  const app = new Hono<AppBindings>();
  app.onError((error, c) =>
    c.json(
      { code: error instanceof AppError ? error.code : 'other' },
      error instanceof AppError ? (error.status as 401) : 500,
    ),
  );
  app.use('/api/v1/*', sessionMiddleware({ getSession }));
  app.get('/api/v1/me', (c) => c.json({ userId: c.get('userId') }));
  app.get('/api/v1/openapi.json', (c) => c.json({ openapi: true }));
  return app;
}

describe('sessionMiddleware', () => {
  it('sets userId from the session', async () => {
    const res = await build(() => Promise.resolve({ user: { id: 'u1' } })).request('/api/v1/me');
    expect(await res.json()).toEqual({ userId: 'u1' });
  });

  it('is SM-CORE-401-001 without a session', async () => {
    const res = await build(() => Promise.resolve(null)).request('/api/v1/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'SM-CORE-401-001' });
  });

  it('reads the session from the request headers only', async () => {
    const getSession = vi.fn().mockResolvedValue({ user: { id: 'u1' } });
    await build(getSession).request('/api/v1/me?userId=evil', {
      headers: { cookie: 'a=b' },
      method: 'GET',
    });
    expect((getSession.mock.calls[0]?.[0] as Headers).get('cookie')).toBe('a=b');
  });

  it('lets the API description through without asking for a session', async () => {
    const getSession = vi.fn().mockResolvedValue(null);
    const res = await build(getSession).request('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('does not swallow a failure of the session store', async () => {
    const res = await build(() => Promise.reject(new Error('mongo down'))).request('/api/v1/me');
    expect(res.status).toBe(500);
  });
});

describe('parseLanguages', () => {
  it('reads an Accept-Language header in order, without weights', () => {
    expect(parseLanguages('es-AR,es;q=0.9,en;q=0.8')).toEqual(['es-AR', 'es', 'en']);
    expect(parseLanguages('en-US, fr;q=0.5')).toEqual(['en-US', 'fr']);
  });

  it('ignores the wildcard, empty parts and a missing header', () => {
    expect(parseLanguages('*')).toEqual([]);
    expect(parseLanguages(',,es,')).toEqual(['es']);
    expect(parseLanguages(null)).toEqual([]);
    expect(parseLanguages(undefined)).toEqual([]);
    expect(parseLanguages('')).toEqual([]);
  });
});
