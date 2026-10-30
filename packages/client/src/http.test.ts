import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, isApiError } from './api-error.js';
import { createHttpClient } from './http.js';

type Call = { url: string; init: RequestInit };

function stub(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchStub = ((url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return Promise.resolve(handler(call));
  }) as unknown as typeof fetch;
  return { calls, fetch: fetchStub };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const envelope = (code: string, messageKey: string, params: Record<string, unknown> = {}) => ({
  success: false,
  error: { code, messageKey, params, requestId: 'req-1', timestamp: '2026-10-30T12:00:00Z' },
});

const headersOf = (call: Call | undefined) => (call?.init.headers ?? {}) as Record<string, string>;
const base = 'https://api.test/api/v1';

afterEach(() => {
  vi.useRealTimers();
});

describe('request shape', () => {
  it('sends the session cookie and asks for JSON', async () => {
    const s = stub(() => json({ ok: true }));
    await createHttpClient({ baseUrl: base, fetch: s.fetch }).get('/bows');
    expect(s.calls[0]?.url).toBe('https://api.test/api/v1/bows');
    expect(s.calls[0]?.init.credentials).toBe('include');
    expect(headersOf(s.calls[0])['Accept']).toBe('application/json');
    expect(s.calls[0]?.init.method).toBe('GET');
  });

  it('joins base and path with a single slash, whatever slashes they carry', async () => {
    const s = stub(() => json({}));
    const http = createHttpClient({ baseUrl: `${base}/`, fetch: s.fetch });
    await http.get('bows');
    await http.get('//bows');
    expect(s.calls.map((c) => c.url)).toEqual([`${base}/bows`, `${base}/bows`]);
  });

  it('builds the query string, dropping undefined values and encoding the rest', async () => {
    const s = stub(() => json({}));
    await createHttpClient({ baseUrl: base, fetch: s.fetch }).get('/bows', {
      query: { status: 'archived', limit: 10, cursor: undefined, q: 'a b&c', flag: false },
    });
    expect(s.calls[0]?.url).toBe(`${base}/bows?status=archived&limit=10&q=a+b%26c&flag=false`);
  });

  it('adds Content-Type only when there is a body', async () => {
    const s = stub(() => json({}));
    const http = createHttpClient({ baseUrl: base, fetch: s.fetch });
    await http.patch('/bows/1', { body: { nickname: 'x' } });
    await http.delete('/bows/1');
    expect(headersOf(s.calls[0])['Content-Type']).toBe('application/json');
    expect(s.calls[0]?.init.body).toBe('{"nickname":"x"}');
    expect(headersOf(s.calls[1])['Content-Type']).toBeUndefined();
    expect(s.calls[1]?.init.body).toBeUndefined();
  });
});

describe('Idempotency-Key and If-Match', () => {
  it('adds a fresh Idempotency-Key to every POST', async () => {
    const s = stub(() => json({}, 201));
    const http = createHttpClient({ baseUrl: base, fetch: s.fetch });
    await http.post('/bows', { body: { id: 'a' } });
    await http.post('/bows', { body: { id: 'b' } });
    const keys = s.calls.map((c) => headersOf(c)['Idempotency-Key']);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('reuses the key it is given, so a retry replays instead of duplicating', async () => {
    const s = stub(() => json({}, 201));
    const http = createHttpClient({ baseUrl: base, fetch: s.fetch });
    await http.post('/bows', { idempotencyKey: 'key-fixed-0001' });
    await http.post('/bows', { idempotencyKey: 'key-fixed-0001' });
    expect(s.calls.map((c) => headersOf(c)['Idempotency-Key'])).toEqual([
      'key-fixed-0001',
      'key-fixed-0001',
    ]);
  });

  it('takes the key generator from the options', async () => {
    const s = stub(() => json({}, 201));
    await createHttpClient({
      baseUrl: base,
      fetch: s.fetch,
      newIdempotencyKey: () => 'generated-key-1',
    }).post('/x');
    expect(headersOf(s.calls[0])['Idempotency-Key']).toBe('generated-key-1');
  });

  it('does not add one to other methods', async () => {
    const s = stub(() => json({}));
    const http = createHttpClient({ baseUrl: base, fetch: s.fetch });
    await http.get('/a');
    await http.patch('/a', { body: {} });
    await http.put('/a', { body: {} });
    await http.delete('/a');
    for (const call of s.calls) expect(headersOf(call)['Idempotency-Key']).toBeUndefined();
  });

  it('sends the version as a quoted If-Match, and none without it', async () => {
    const s = stub(() => json({}));
    const http = createHttpClient({ baseUrl: base, fetch: s.fetch });
    await http.patch('/bows/1', { body: {}, version: 7 });
    await http.patch('/bows/1', { body: {} });
    expect(headersOf(s.calls[0])['If-Match']).toBe('"7"');
    expect(headersOf(s.calls[1])['If-Match']).toBeUndefined();
  });

  it('exposes the generator for callers that retry', () => {
    const http = createHttpClient({ baseUrl: base, newIdempotencyKey: () => 'k-0000-0001' });
    expect(http.newIdempotencyKey()).toBe('k-0000-0001');
  });
});

describe('responses', () => {
  it('returns the parsed body of a 2xx', async () => {
    const s = stub(() => json({ id: 'a', version: 1 }, 201));
    const result = await createHttpClient({ baseUrl: base, fetch: s.fetch }).post('/bows');
    expect(result).toEqual({ id: 'a', version: 1 });
  });

  it('returns undefined for an empty 204', async () => {
    const s = stub(() => new Response(null, { status: 204 }));
    expect(
      await createHttpClient({ baseUrl: base, fetch: s.fetch }).delete('/bows/1'),
    ).toBeUndefined();
  });

  it('validates the body when given a schema', async () => {
    const schema = z.object({ id: z.string(), version: z.number() });
    const good = stub(() => json({ id: 'a', version: 2 }));
    expect(
      await createHttpClient({ baseUrl: base, fetch: good.fetch }).get('/x', { schema }),
    ).toEqual({ id: 'a', version: 2 });

    const bad = stub(() => json({ id: 'a' }));
    const error = await createHttpClient({ baseUrl: base, fetch: bad.fetch })
      .get('/x', { schema })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'SM-NET-500-001' });
  });

  it('turns a 2xx that is not JSON into SM-NET-500-001', async () => {
    const s = stub(() => new Response('<html>', { status: 200 }));
    const error = await createHttpClient({ baseUrl: base, fetch: s.fetch })
      .get('/x')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'SM-NET-500-001' });
  });
});

describe('errors', () => {
  it('a 409 with an envelope becomes an ApiError with code, key and params', async () => {
    const s = stub(() =>
      json(
        envelope('SM-MARK-409-001', 'errors.mark.duplicateDistance', {
          existingMarkId: 'm1',
          distanceM: 40,
        }),
        409,
      ),
    );
    const error = await createHttpClient({ baseUrl: base, fetch: s.fetch })
      .post('/marks')
      .catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      code: 'SM-MARK-409-001',
      messageKey: 'errors.mark.duplicateDistance',
      params: { existingMarkId: 'm1', distanceM: 40 },
      requestId: 'req-1',
      status: 409,
      isNetwork: false,
    });
  });

  it('a body that is not an envelope is SM-NET-500-001 with the HTTP status', async () => {
    const s = stub(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await createHttpClient({ baseUrl: base, fetch: s.fetch })
      .get('/x')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'SM-NET-500-001', params: { status: 502 } });
  });

  it('keeps an unknown future code as a generic error with the server message key', async () => {
    const s = stub(() => json(envelope('SM-FUTURE-418-001', 'errors.future.teapot'), 418));
    const error = await createHttpClient({ baseUrl: base, fetch: s.fetch })
      .get('/x')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'SM-CORE-500-001', messageKey: 'errors.future.teapot' });
  });

  it('a lost connection is SM-NET-503-001', async () => {
    const fetchStub = (() =>
      Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    const error = await createHttpClient({ baseUrl: base, fetch: fetchStub })
      .get('/x')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'SM-NET-503-001', isNetwork: true });
  });

  it('offline fails at once, without calling fetch', async () => {
    const s = stub(() => json({}));
    const error = await createHttpClient({ baseUrl: base, fetch: s.fetch, isOnline: () => false })
      .get('/x')
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'SM-NET-503-001' });
    expect(s.calls).toHaveLength(0);
  });

  it('calls onUnauthenticated on SM-CORE-401-001 and still throws', async () => {
    const onUnauthenticated = vi.fn();
    const s = stub(() => json(envelope('SM-CORE-401-001', 'errors.core.unauthenticated'), 401));
    const error = await createHttpClient({ baseUrl: base, fetch: s.fetch, onUnauthenticated })
      .get('/me')
      .catch((e: unknown) => e);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ code: 'SM-CORE-401-001' });
  });

  it('does not call onUnauthenticated for other errors', async () => {
    const onUnauthenticated = vi.fn();
    const s = stub(() => json(envelope('SM-CORE-404-002', 'errors.core.notFound'), 404));
    await createHttpClient({ baseUrl: base, fetch: s.fetch, onUnauthenticated })
      .get('/x')
      .catch(() => undefined);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});

describe('timeout and cancellation', () => {
  const hanging = (): typeof fetch =>
    ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      })) as unknown as typeof fetch;

  it('gives up after 10 s with SM-NET-504-001', async () => {
    vi.useFakeTimers();
    const pending = createHttpClient({ baseUrl: base, fetch: hanging() })
      .get('/slow')
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(9_999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ code: 'SM-NET-504-001', isNetwork: true });
  });

  it('honours a custom timeout', async () => {
    vi.useFakeTimers();
    const pending = createHttpClient({ baseUrl: base, fetch: hanging(), timeoutMs: 50 })
      .get('/slow')
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toMatchObject({ code: 'SM-NET-504-001' });
  });

  it('lets the caller cancel: the abort is rethrown as it is, not reported as a network error', async () => {
    const controller = new AbortController();
    const pending = createHttpClient({ baseUrl: base, fetch: hanging() })
      .get('/slow', { signal: controller.signal })
      .catch((e: unknown) => e);
    controller.abort();
    const error = await pending;
    expect(isApiError(error)).toBe(false);
    expect((error as Error).name).toBe('AbortError');
  });

  it('a signal that is already aborted never reaches the network as a success', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await createHttpClient({ baseUrl: base, fetch: hanging() })
      .get('/slow', { signal: controller.signal })
      .catch((e: unknown) => e);
    expect(isApiError(error)).toBe(false);
  });

  it('clears its timer after a quick answer', async () => {
    vi.useFakeTimers();
    const s = stub(() => json({}));
    await createHttpClient({ baseUrl: base, fetch: s.fetch }).get('/x');
    expect(vi.getTimerCount()).toBe(0);
  });
});
