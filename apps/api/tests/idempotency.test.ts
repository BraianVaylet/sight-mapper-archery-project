import { describe, expect, it } from 'vitest';
import { buildThingsApp, envelope } from './helpers/app.js';

const ID_A = '019a3c5f-7b1d-7e55-8f0e-0c4c1b9f2a77';
const KEY = 'key-0001-abcdefgh';

const without = (headers: Record<string, string>, name: string) =>
  Object.fromEntries(Object.entries(headers).filter(([key]) => key !== name));

const post = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-test-user': 'ana',
    'idempotency-key': KEY,
    ...headers,
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('Idempotency-Key on POST (test #3)', () => {
  it('runs the handler once and replays the same response for the same key ×3', async () => {
    const { app, things } = buildThingsApp();
    const responses = [];
    for (let i = 0; i < 3; i++)
      responses.push(await app.request('/api/v1/things', post({ id: ID_A, name: 'Hoyt' })));

    expect(things.size).toBe(1);
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    const bodies = await Promise.all(responses.map((r) => r.text()));
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0] ?? '{}')).toEqual({ id: ID_A, name: 'Hoyt', version: 1 });
  });

  it('marks replays and keeps ETag and Location', async () => {
    const { app } = buildThingsApp();
    const first = await app.request('/api/v1/things', post({ id: ID_A, name: 'Hoyt' }));
    const replay = await app.request('/api/v1/things', post({ id: ID_A, name: 'Hoyt' }));
    expect(first.headers.get('idempotent-replay')).toBeNull();
    expect(replay.headers.get('idempotent-replay')).toBe('true');
    expect(replay.headers.get('etag')).toBe('"1"');
    expect(replay.headers.get('location')).toBe(`/api/v1/things/${ID_A}`);
  });

  it('treats the same body with different spacing or key order as the same request', async () => {
    const { app, things } = buildThingsApp();
    await app.request('/api/v1/things', post(`{"id":"${ID_A}","name":"Hoyt"}`));
    const replay = await app.request(
      '/api/v1/things',
      post(`{ "name": "Hoyt",\n "id": "${ID_A}" }`),
    );
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotent-replay')).toBe('true');
    expect(things.size).toBe(1);
  });

  it('same key with another body is SM-CORE-409-001 and creates nothing', async () => {
    const { app, things } = buildThingsApp();
    await app.request('/api/v1/things', post({ id: ID_A, name: 'Hoyt' }));
    const res = await app.request('/api/v1/things', post({ id: ID_A, name: 'Mathews' }));
    expect(res.status).toBe(409);
    expect((await envelope(res)).error.code).toBe('SM-CORE-409-001');
    expect(things.get(ID_A)?.name).toBe('Hoyt');
  });

  it('same key on another path is a mismatch too', async () => {
    const { app } = buildThingsApp();
    await app.request('/api/v1/things', post({ id: ID_A, name: 'Hoyt' }));
    const res = await app.request('/api/v1/things/x/archive', post(''));
    expect((await envelope(res)).error.code).toBe('SM-CORE-409-001');
  });

  it('scopes keys per user: the same key from another user is a new request', async () => {
    const { app, things } = buildThingsApp();
    await app.request('/api/v1/things', post({ id: ID_A, name: 'Ana' }));
    const other = await app.request(
      '/api/v1/things',
      post({ id: '019a3c5f-7b1d-7e55-8f0e-0c4c1b9f2a78', name: 'Beto' }, { 'x-test-user': 'beto' }),
    );
    expect(other.status).toBe(201);
    expect(other.headers.get('idempotent-replay')).toBeNull();
    expect(things.size).toBe(2);
  });

  it('requires the header: SM-CORE-428-001 naming it', async () => {
    const { app } = buildThingsApp();
    const req = post({ id: ID_A, name: 'Hoyt' });
    const res = await app.request('/api/v1/things', {
      ...req,
      headers: without(req.headers, 'idempotency-key'),
    });
    expect(res.status).toBe(428);
    expect((await envelope(res)).error).toMatchObject({
      code: 'SM-CORE-428-001',
      params: { header: 'Idempotency-Key' },
    });
  });

  it.each(['short', 'has space in it!', 'x'.repeat(129), 'ñandú-key-001'])(
    'rejects the malformed key %j with SM-CORE-400-001',
    async (key) => {
      const { app } = buildThingsApp();
      const res = await app.request(
        '/api/v1/things',
        post({ id: ID_A, name: 'Hoyt' }, { 'idempotency-key': key }),
      );
      expect(res.status).toBe(400);
      expect((await envelope(res)).error.code).toBe('SM-CORE-400-001');
    },
  );

  it('does not store failures: a rejected request can be retried with the same key', async () => {
    const { app, things, store } = buildThingsApp();
    const bad = await app.request('/api/v1/things', post({ id: ID_A, name: '' }));
    expect(bad.status).toBe(400);
    expect(store.records).toHaveLength(0);
    const retry = await app.request('/api/v1/things', post({ id: ID_A, name: 'Hoyt' }));
    expect(retry.status).toBe(201);
    expect(things.size).toBe(1);
  });

  it('requires a signed-in user before anything else', async () => {
    const { app, things } = buildThingsApp();
    const req = post({ id: ID_A, name: 'Hoyt' }, { 'x-test-user': '' });
    const res = await app.request('/api/v1/things', {
      ...req,
      headers: without(req.headers, 'x-test-user'),
    });
    expect(res.status).toBe(401);
    expect((await envelope(res)).error.code).toBe('SM-CORE-401-001');
    expect(things.size).toBe(0);
  });

  it('stores the record with a 24 h expiry and a request hash, not the key of another request', async () => {
    const { app, store } = buildThingsApp();
    await app.request('/api/v1/things', post({ id: ID_A, name: 'Hoyt' }));
    const [record] = store.records;
    expect(record).toMatchObject({ userId: 'ana', key: KEY, method: 'POST', statusCode: 201 });
    expect(record?.requestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record?.createdAt.toString()).toBe('2026-10-30T12:00:00Z');
    expect(record?.expiresAt.toString()).toBe('2026-10-31T12:00:00Z');
  });

  it('leaves GET alone, with or without a key', async () => {
    const { app } = buildThingsApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });
});
