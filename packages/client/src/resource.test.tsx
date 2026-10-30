import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createHttpClient } from './http.js';
import { ClientProvider, queryClientConfig } from './provider.js';
import { createResourceHooks } from './resource.js';

type Thing = { id: string; name: string; version: number };

const thingSchema = z.object({ id: z.string(), name: z.string(), version: z.number() });
const things = createResourceHooks<Thing, { id: string; name: string }, { name: string }>({
  name: 'things',
  path: '/things',
  schema: thingSchema,
});

const envelope = (code: string, messageKey: string, params: Record<string, unknown> = {}) => ({
  success: false,
  error: { code, messageKey, params, requestId: 'req-1', timestamp: 'now' },
});

type Seen = { method: string; path: string; headers: Record<string, string> };

/** A fake API that enforces the wire contract: idempotent POSTs and versioned writes. */
function fakeServer() {
  const store = new Map<string, Thing>();
  const replays = new Map<string, Thing>();
  const seen: Seen[] = [];
  let failNext: { status: number; body: unknown } | null = null;

  const reply = (body: unknown, status = 200) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status });

  const fetchStub = ((input: string, init: RequestInit) => {
    const url = new URL(input);
    const path = url.pathname.replace('/api/v1', '');
    const method = init.method ?? 'GET';
    const headers = init.headers as Record<string, string>;
    seen.push({ method, path, headers });

    if (failNext !== null) {
      const fail = failNext;
      failNext = null;
      return Promise.resolve(reply(fail.body, fail.status));
    }

    const [, , id, action] = path.split('/');
    if (method === 'GET' && id === undefined) {
      return Promise.resolve(reply({ items: [...store.values()], nextCursor: null }));
    }
    if (method === 'GET' && id !== undefined) {
      const found = store.get(id);
      return Promise.resolve(
        found ? reply(found) : reply(envelope('SM-CORE-404-002', 'errors.core.notFound'), 404),
      );
    }
    if (method === 'POST' && id === undefined) {
      const key = headers['Idempotency-Key'] ?? '';
      const replay = replays.get(key);
      if (replay) return Promise.resolve(reply(replay, 201));
      const body = JSON.parse(init.body as string) as { id: string; name: string };
      const created = { ...body, version: 1 };
      store.set(created.id, created);
      replays.set(key, created);
      return Promise.resolve(reply(created, 201));
    }
    const current = id === undefined ? undefined : store.get(id);
    if (!current)
      return Promise.resolve(reply(envelope('SM-CORE-404-002', 'errors.core.notFound'), 404));
    if (method === 'POST' && action === 'archive') {
      current.version += 1;
      return Promise.resolve(reply(current));
    }
    if (headers['If-Match'] !== `"${current.version}"`) {
      return Promise.resolve(
        reply(
          envelope('SM-CORE-412-001', 'errors.core.staleWrite', {
            currentVersion: current.version,
          }),
          412,
        ),
      );
    }
    if (method === 'PATCH') {
      Object.assign(current, JSON.parse(init.body as string));
      current.version += 1;
      return Promise.resolve(reply(current));
    }
    store.delete(current.id);
    return Promise.resolve(reply(undefined, 204));
  }) as unknown as typeof fetch;

  return {
    store,
    seen,
    fetch: fetchStub,
    failNext: (status: number, body: unknown) => void (failNext = { status, body }),
    /** Someone else changes the thing behind the client's back. */
    editElsewhere: (id: string, name: string) => {
      const t = store.get(id);
      if (t) Object.assign(t, { name, version: t.version + 1 });
    },
  };
}

function setup(server = fakeServer()) {
  const http = createHttpClient({
    baseUrl: 'https://api.test/api/v1',
    fetch: server.fetch,
    newIdempotencyKey: (() => {
      let n = 0;
      return () => `key-${String(++n).padStart(8, '0')}`;
    })(),
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { ...queryClientConfig.defaultOptions?.queries, retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ClientProvider http={http}>{children}</ClientProvider>
    </QueryClientProvider>
  );
  return { server, client, wrapper };
}

describe('ClientProvider', () => {
  it('fails loudly when a hook has no client above it', () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    expect(() => renderHook(() => things.useList(), { wrapper })).toThrow(/ClientProvider/);
  });

  it('configures reads with the retry policy and no retry for mutations', () => {
    expect(queryClientConfig.defaultOptions?.queries?.staleTime).toBe(30_000);
    expect(queryClientConfig.defaultOptions?.mutations?.retry).toBe(false);
  });
});

describe('queries', () => {
  it('lists and shows a detail, validated against the schema', async () => {
    const { server, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 1 });
    const list = renderHook(() => things.useList({ status: 'active' }), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(list.result.current.data?.items).toEqual([{ id: 'a', name: 'Hoyt', version: 1 }]);

    const detail = renderHook(() => things.useDetail('a'), { wrapper });
    await waitFor(() => expect(detail.result.current.data?.name).toBe('Hoyt'));
  });

  it('does not fetch a detail without an id', () => {
    const { server, wrapper } = setup();
    const detail = renderHook(() => things.useDetail(undefined), { wrapper });
    expect(detail.result.current.fetchStatus).toBe('idle');
    expect(server.seen).toHaveLength(0);
  });

  it('surfaces a 404 as an ApiError', async () => {
    const { wrapper } = setup();
    const detail = renderHook(() => things.useDetail('nope'), { wrapper });
    await waitFor(() => expect(detail.result.current.isError).toBe(true));
    expect(detail.result.current.error).toMatchObject({ code: 'SM-CORE-404-002' });
  });
});

describe('create', () => {
  it('sends one Idempotency-Key per user action and caches the result', async () => {
    const { server, client, wrapper } = setup();
    const { result } = renderHook(() => things.useCreate(), { wrapper });
    let created: Thing | undefined;
    await act(async () => {
      created = await result.current.create({ id: 'a', name: 'Hoyt' });
    });
    expect(created).toEqual({ id: 'a', name: 'Hoyt', version: 1 });
    expect(client.getQueryData(things.keys.detail('a'))).toEqual(created);
    expect(server.seen[0]?.headers['Idempotency-Key']).toBe('key-00000001');

    await act(async () => {
      await result.current.create({ id: 'b', name: 'Mathews' });
    });
    expect(server.seen.find((s) => s.method === 'POST' && s.path === '/things')).toBeDefined();
    const keys = server.seen
      .filter((s) => s.method === 'POST')
      .map((s) => s.headers['Idempotency-Key']);
    expect(new Set(keys).size).toBe(2);
  });

  it('refreshes the lists afterwards', async () => {
    const { client, wrapper } = setup();
    // TanStack re-renders only for what is read while rendering, so read `items` there.
    const list = renderHook(
      () => {
        const query = things.useList();
        return { ready: query.isSuccess, items: query.data?.items };
      },
      { wrapper },
    );
    await waitFor(() => expect(list.result.current.ready).toBe(true));
    const create = renderHook(() => things.useCreate(), { wrapper });
    await act(async () => {
      await create.result.current.create({ id: 'a', name: 'Hoyt' });
    });
    await waitFor(() => expect(list.result.current.items).toHaveLength(1));
    expect(client.getQueryState(things.keys.list())?.isInvalidated).toBe(false);
  });
});

describe('update (test #7 from the client)', () => {
  it('sends the cached version as If-Match and shows the change at once', async () => {
    const { server, client, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 3 });
    const detail = renderHook(() => things.useDetail('a'), { wrapper });
    await waitFor(() => expect(detail.result.current.data?.version).toBe(3));

    const update = renderHook(() => things.useUpdate(), { wrapper });
    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = update.result.current.mutateAsync({ id: 'a', patch: { name: 'Mathews' } });
    });
    await waitFor(() =>
      expect((client.getQueryData(things.keys.detail('a')) as Thing).name).toBe('Mathews'),
    );
    await act(async () => void (await pending));

    const patch = server.seen.find((s) => s.method === 'PATCH');
    expect(patch?.headers['If-Match']).toBe('"3"');
    expect(client.getQueryData(things.keys.detail('a'))).toEqual({
      id: 'a',
      name: 'Mathews',
      version: 4,
    });
  });

  it('finds the version in a list when there is no detail yet', async () => {
    const { server, client, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 5 });
    const list = renderHook(() => things.useList(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(things.cachedVersion(client, 'a')).toBe(5);

    const update = renderHook(() => things.useUpdate(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({ id: 'a', patch: { name: 'X' } });
    });
    expect(server.seen.find((s) => s.method === 'PATCH')?.headers['If-Match']).toBe('"5"');
    // the version came from the list: no extra GET of the detail
    expect(server.seen.filter((s) => s.path === '/things/a' && s.method === 'GET')).toHaveLength(0);
  });

  it('fetches the resource first when the cache never saw it', async () => {
    const { server, client, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 9 });
    expect(things.cachedVersion(client, 'a')).toBeUndefined();
    const update = renderHook(() => things.useUpdate(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({ id: 'a', patch: { name: 'X' } });
    });
    expect(server.seen[0]).toMatchObject({ method: 'GET', path: '/things/a' });
    expect(server.seen.find((s) => s.method === 'PATCH')?.headers['If-Match']).toBe('"9"');
  });

  it('on a stale write: rolls back, raises SM-CORE-412-001 and loads the newer copy', async () => {
    const { server, client, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 1 });
    const detail = renderHook(() => things.useDetail('a'), { wrapper });
    await waitFor(() => expect(detail.result.current.data?.version).toBe(1));

    server.editElsewhere('a', 'Edited elsewhere');
    const update = renderHook(() => things.useUpdate(), { wrapper });
    const error = await act(async () =>
      update.result.current
        .mutateAsync({ id: 'a', patch: { name: 'Late edit' } })
        .catch((e: unknown) => e),
    );
    expect(error).toMatchObject({ code: 'SM-CORE-412-001', params: { currentVersion: 2 } });

    await waitFor(() =>
      expect(client.getQueryData(things.keys.detail('a'))).toEqual({
        id: 'a',
        name: 'Edited elsewhere',
        version: 2,
      }),
    );
    expect(server.store.get('a')?.name).toBe('Edited elsewhere');
  });

  it('restores the previous copy when the update fails for another reason', async () => {
    const { server, client, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 1 });
    const detail = renderHook(() => things.useDetail('a'), { wrapper });
    await waitFor(() => expect(detail.result.current.data?.version).toBe(1));
    const update = renderHook(() => things.useUpdate(), { wrapper });

    server.failNext(500, envelope('SM-CORE-500-001', 'errors.core.unexpected'));
    // the first request of the mutation is the failing PATCH (the version is already cached)
    const error = await act(async () =>
      update.result.current
        .mutateAsync({ id: 'a', patch: { name: 'Nope' } })
        .catch((e: unknown) => e),
    );
    expect(error).toMatchObject({ code: 'SM-CORE-500-001' });
    await waitFor(() =>
      expect((client.getQueryData(things.keys.detail('a')) as Thing).name).toBe('Hoyt'),
    );
  });
});

describe('remove and action', () => {
  it('deletes with the cached version and forgets the detail', async () => {
    const { server, client, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 2 });
    const detail = renderHook(() => things.useDetail('a'), { wrapper });
    await waitFor(() => expect(detail.result.current.data?.version).toBe(2));

    const remove = renderHook(() => things.useRemove(), { wrapper });
    await act(async () => {
      await remove.result.current.mutateAsync({ id: 'a' });
    });
    expect(server.seen.find((s) => s.method === 'DELETE')?.headers['If-Match']).toBe('"2"');
    expect(server.store.has('a')).toBe(false);
    expect(client.getQueryData(things.keys.detail('a'))).toBeUndefined();
  });

  it('a stale delete is SM-CORE-412-001 and deletes nothing', async () => {
    const { server, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 1 });
    const detail = renderHook(() => things.useDetail('a'), { wrapper });
    await waitFor(() => expect(detail.result.current.data?.version).toBe(1));
    server.editElsewhere('a', 'x');
    const remove = renderHook(() => things.useRemove(), { wrapper });
    const error = await act(async () =>
      remove.result.current.mutateAsync({ id: 'a' }).catch((e: unknown) => e),
    );
    expect(error).toMatchObject({ code: 'SM-CORE-412-001' });
    expect(server.store.has('a')).toBe(true);
  });

  it('runs a state action as a POST with its own key, never a PATCH', async () => {
    const { server, wrapper } = setup();
    server.store.set('a', { id: 'a', name: 'Hoyt', version: 1 });
    const action = renderHook(() => things.useAction(), { wrapper });
    await act(async () => {
      await action.result.current.run('a', 'archive');
    });
    const call = server.seen.find((s) => s.path === '/things/a/archive');
    expect(call?.method).toBe('POST');
    expect(call?.headers['Idempotency-Key']).toMatch(/^key-/);
    expect(call?.headers['If-Match']).toBeUndefined();
    expect(server.store.get('a')?.version).toBe(2);
  });
});
