import { createRoute, z } from '@hono/zod-openapi';
import { uuidv7 } from '@sight-mapper/schemas';
import { describe, expect, it } from 'vitest';
import { etagOf } from '../src/core/concurrency/concurrency.js';
import { buildThingsApp, envelope } from './helpers/app.js';

const ID_A = '019a3c5f-7b1d-7e55-8f0e-0c4c1b9f2a77';
const headers = (extra: Record<string, string> = {}) => ({
  'content-type': 'application/json',
  'x-test-user': 'ana',
  ...extra,
});
const create = (app: ReturnType<typeof buildThingsApp>['app'], key = 'key-0001-abcdefgh') =>
  app.request('/api/v1/things', {
    method: 'POST',
    headers: headers({ 'idempotency-key': key }),
    body: JSON.stringify({ id: ID_A, name: 'Hoyt' }),
  });
const patch = (
  app: ReturnType<typeof buildThingsApp>['app'],
  ifMatch: string | undefined,
  name = 'Mathews',
) =>
  app.request(`/api/v1/things/${ID_A}`, {
    method: 'PATCH',
    headers: headers(ifMatch === undefined ? {} : { 'if-match': ifMatch }),
    body: JSON.stringify({ name }),
  });

describe('ETag and If-Match (test #7)', () => {
  it('a created resource carries its version as a strong ETag', async () => {
    const { app } = buildThingsApp();
    const res = await create(app);
    expect(res.headers.get('etag')).toBe('"1"');
    expect(etagOf(12)).toBe('"12"');
  });

  it('a PATCH with the current version succeeds and bumps the ETag', async () => {
    const { app } = buildThingsApp();
    await create(app);
    const res = await patch(app, '"1"');
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"2"');
    expect(await res.json()).toMatchObject({ name: 'Mathews', version: 2 });
  });

  it('a PATCH with an old version is SM-CORE-412-001 and changes nothing', async () => {
    const { app, things } = buildThingsApp();
    await create(app);
    await patch(app, '"1"');
    const stale = await patch(app, '"1"', 'Late edit');
    expect(stale.status).toBe(412);
    expect((await envelope(stale)).error).toMatchObject({
      code: 'SM-CORE-412-001',
      params: { currentVersion: 2 },
    });
    expect(things.get(ID_A)).toMatchObject({ name: 'Mathews', version: 2 });
  });

  it('a PATCH without If-Match is SM-CORE-428-001 naming the header', async () => {
    const { app } = buildThingsApp();
    await create(app);
    const res = await patch(app, undefined);
    expect(res.status).toBe(428);
    expect((await envelope(res)).error).toMatchObject({
      code: 'SM-CORE-428-001',
      params: { header: 'If-Match' },
    });
  });

  it.each(['1', 'W/"1"', '"abc"', '*', '"1", "2"', '""'])(
    'an If-Match that is not one of our ETags (%j) is a stale write, not a pass',
    async (value) => {
      const { app, things } = buildThingsApp();
      await create(app);
      const res = await patch(app, value);
      expect(res.status).toBe(412);
      expect(things.get(ID_A)?.version).toBe(1);
    },
  );

  it('DELETE needs If-Match too', async () => {
    const { app } = buildThingsApp();
    await create(app);
    const res = await app.request(`/api/v1/things/${ID_A}`, {
      method: 'DELETE',
      headers: headers(),
    });
    expect(res.status).toBe(428);
    const ok = await app.request(`/api/v1/things/${ID_A}`, {
      method: 'DELETE',
      headers: headers({ 'if-match': '"1"' }),
    });
    expect(ok.status).toBe(204);
  });

  it('lets listed actions without a versioned resource skip the check', async () => {
    const { app } = buildThingsApp({ ifMatchExempt: [`DELETE /api/v1/things/${ID_A}`] });
    await create(app);
    const res = await app.request(`/api/v1/things/${ID_A}`, {
      method: 'DELETE',
      headers: headers(),
    });
    expect(res.status).toBe(204);
  });

  it('does not ask GET or POST for If-Match', async () => {
    const { app } = buildThingsApp();
    expect((await create(app)).status).toBe(201);
    expect((await app.request('/health')).status).toBe(200);
  });
});

describe('malformed ids', () => {
  const build = () => {
    const container = buildThingsApp();
    const body = z.object({ id: uuidv7, arrowSetIds: z.array(uuidv7), name: z.string().min(1) });
    container.registry.register(
      createRoute({
        method: 'put',
        path: '/api/v1/ids/{id}',
        request: {
          params: z.object({ id: uuidv7 }),
          body: { content: { 'application/json': { schema: body.partial() } } },
        },
        responses: { 200: { description: 'ok' } },
      }),
      (c) => c.body(null, 200),
      { auth: 'session' },
    );
    return container.app;
  };
  const put = (app: ReturnType<typeof build>, path: string, body: unknown) =>
    app.request(path, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });

  it('a lone malformed id in the body is SM-CORE-400-002 naming the field', async () => {
    const res = await put(build(), `/api/v1/ids/${ID_A}`, { id: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect((await envelope(res)).error).toMatchObject({
      code: 'SM-CORE-400-002',
      params: { field: 'id' },
    });
  });

  it('also for a path parameter and for an element of an id list', async () => {
    const app = build();
    const inPath = await put(app, '/api/v1/ids/nope', {});
    expect((await envelope(inPath)).error).toMatchObject({
      code: 'SM-CORE-400-002',
      params: { field: 'id' },
    });
    const inList = await put(app, `/api/v1/ids/${ID_A}`, { arrowSetIds: [ID_A, 'bad'] });
    expect((await envelope(inList)).error).toMatchObject({
      code: 'SM-CORE-400-002',
      params: { field: 'arrowSetIds.1' },
    });
  });

  it('a UUID of another version is malformed too', async () => {
    const res = await put(build(), `/api/v1/ids/${ID_A}`, {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
    expect((await envelope(res)).error.code).toBe('SM-CORE-400-002');
  });

  it('a malformed id next to other problems is a normal validation error', async () => {
    const res = await put(build(), `/api/v1/ids/${ID_A}`, { id: 'bad', name: '' });
    expect((await envelope(res)).error.code).toBe('SM-CORE-400-001');
  });

  it('other format failures are not ids', async () => {
    const res = await put(build(), `/api/v1/ids/${ID_A}`, { name: 5 });
    expect((await envelope(res)).error.code).toBe('SM-CORE-400-001');
  });
});
