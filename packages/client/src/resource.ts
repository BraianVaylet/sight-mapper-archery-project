import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { z } from 'zod';
import type { ApiError } from './api-error.js';
import type { Query } from './http.js';
import { useHttp } from './provider.js';

export type Versioned = { readonly id: string; readonly version: number };

export type Page<R> = { items: R[]; nextCursor: string | null };

export type ResourceConfig<R extends Versioned> = {
  /** Root of every query key: `'bows'`. */
  name: string;
  /** Collection path under the base URL: `'/bows'`. */
  path: string;
  schema: z.ZodType<R>;
};

/**
 * Hooks for one resource of the API (list, detail, create, update, remove, action). Written once
 * so each screen only says what it wants, and the rules of the wire live in a single place:
 *
 * - a POST carries one `Idempotency-Key` per user action (ADR-006);
 * - a PATCH/DELETE sends the `version` it holds in the cache as `If-Match`, and a 412 refreshes
 *   the cache so the screen can show "someone changed it before" with the newer data;
 * - updates are optimistic and roll back on failure (TECNICO §8).
 */
export function createResourceHooks<
  R extends Versioned,
  C extends { id: string },
  U extends object,
>(config: ResourceConfig<R>) {
  const { name, path, schema } = config;
  const pageSchema = z.object({ items: z.array(schema), nextCursor: z.string().nullable() });

  const keys = {
    all: [name] as const,
    lists: [name, 'list'] as const,
    list: (params: Query = {}) => [name, 'list', params] as const,
    detail: (id: string) => [name, 'detail', id] as const,
  };

  /** The newest version the client knows of `id`, from its detail or from any cached list. */
  function cachedVersion(client: QueryClient, id: string): number | undefined {
    const detail = client.getQueryData<R>(keys.detail(id));
    if (detail !== undefined) return detail.version;
    for (const [, page] of client.getQueriesData<Page<R>>({ queryKey: keys.lists })) {
      const found = page?.items.find((item) => item.id === id);
      if (found !== undefined) return found.version;
    }
    return undefined;
  }

  function useList(params: Query = {}) {
    const http = useHttp();
    return useQuery<Page<R>, ApiError>({
      queryKey: keys.list(params),
      queryFn: ({ signal }) => http.get(path, { query: params, signal, schema: pageSchema }),
    });
  }

  function useDetail(id: string | undefined) {
    const http = useHttp();
    return useQuery<R, ApiError>({
      queryKey: keys.detail(id ?? ''),
      queryFn: ({ signal }) => http.get(`${path}/${id ?? ''}`, { signal, schema }),
      enabled: id !== undefined,
    });
  }

  function useCreate() {
    const http = useHttp();
    const client = useQueryClient();
    const mutation = useMutation<R, ApiError, { input: C; idempotencyKey: string }>({
      mutationFn: ({ input, idempotencyKey }) =>
        http.post(path, { body: input, idempotencyKey, schema }),
      onSuccess: (created) => client.setQueryData(keys.detail(created.id), created),
      onSettled: () => client.invalidateQueries({ queryKey: keys.lists }),
    });
    return {
      ...mutation,
      /** One `Idempotency-Key` per call, so repeating the same action cannot create twice. */
      create: (input: C) =>
        mutation.mutateAsync({ input, idempotencyKey: http.newIdempotencyKey() }),
    };
  }

  /** Reads the version to send; if the cache never saw the resource, fetches it first. */
  async function versionFor(client: QueryClient, http: ReturnType<typeof useHttp>, id: string) {
    const known = cachedVersion(client, id);
    if (known !== undefined) return known;
    const fresh = await client.fetchQuery({
      queryKey: keys.detail(id),
      queryFn: ({ signal }) => http.get<R>(`${path}/${id}`, { signal, schema }),
    });
    return fresh.version;
  }

  function useUpdate() {
    const http = useHttp();
    const client = useQueryClient();
    return useMutation<R, ApiError, { id: string; patch: U }, { previous: R | undefined }>({
      mutationFn: async ({ id, patch }) =>
        http.patch(`${path}/${id}`, {
          body: patch,
          version: await versionFor(client, http, id),
          schema,
        }),
      onMutate: async ({ id, patch }) => {
        await client.cancelQueries({ queryKey: keys.detail(id) });
        const previous = client.getQueryData<R>(keys.detail(id));
        if (previous !== undefined) client.setQueryData(keys.detail(id), { ...previous, ...patch });
        return { previous };
      },
      onError: (_error, { id }, context) => {
        if (context?.previous !== undefined) client.setQueryData(keys.detail(id), context.previous);
      },
      onSuccess: (updated) => client.setQueryData(keys.detail(updated.id), updated),
      // After success *and* failure: a 412 needs the newer copy, a success needs fresh lists.
      onSettled: (_data, _error, { id }) =>
        Promise.all([
          client.invalidateQueries({ queryKey: keys.detail(id) }),
          client.invalidateQueries({ queryKey: keys.lists }),
        ]),
    });
  }

  function useRemove() {
    const http = useHttp();
    const client = useQueryClient();
    return useMutation<undefined, ApiError, { id: string }>({
      mutationFn: async ({ id }) => {
        await http.delete(`${path}/${id}`, { version: await versionFor(client, http, id) });
        return undefined;
      },
      onSuccess: (_result, { id }) => client.removeQueries({ queryKey: keys.detail(id) }),
      onSettled: (_data, _error, { id }) =>
        Promise.all([
          client.invalidateQueries({ queryKey: keys.detail(id) }),
          client.invalidateQueries({ queryKey: keys.lists }),
        ]),
    });
  }

  /** `POST /:id/<action>` (archive, unarchive, restore): a state change is never a PATCH. */
  function useAction() {
    const http = useHttp();
    const client = useQueryClient();
    const mutation = useMutation<
      R | undefined,
      ApiError,
      { id: string; action: string; idempotencyKey: string }
    >({
      mutationFn: ({ id, action, idempotencyKey }) =>
        http.post(`${path}/${id}/${action}`, { idempotencyKey }),
      onSettled: (_data, _error, { id }) =>
        Promise.all([
          client.invalidateQueries({ queryKey: keys.detail(id) }),
          client.invalidateQueries({ queryKey: keys.lists }),
        ]),
    });
    return {
      ...mutation,
      run: (id: string, action: string) =>
        mutation.mutateAsync({ id, action, idempotencyKey: http.newIdempotencyKey() }),
    };
  }

  return { keys, cachedVersion, useList, useDetail, useCreate, useUpdate, useRemove, useAction };
}

export type ResourceHooks<
  R extends Versioned,
  C extends { id: string },
  U extends object,
> = ReturnType<typeof createResourceHooks<R, C, U>>;

export type { QueryKey };
