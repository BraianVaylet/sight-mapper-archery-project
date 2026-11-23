import { useHttp } from '@sight-mapper/client';
import { nowIso } from '../../app/device-time.js';
import { mark, type CreateMark, type Mark, type UpdateMark } from '@sight-mapper/schemas';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

const listSchema = z.object({ items: z.array(mark) });

export const marksKey = (setupId: string, arrowSetId: string) =>
  ['marks', setupId, arrowSetId] as const;

/** Every live mark of one (setup, arrow set) pair, nearest first (HU-MRK-04). */
export function useMarks(setupId: string, arrowSetId: string | undefined) {
  const http = useHttp();
  return useQuery({
    queryKey: marksKey(setupId, arrowSetId ?? ''),
    enabled: arrowSetId !== undefined,
    queryFn: ({ signal }) =>
      http.get(`/setups/${encodeURIComponent(setupId)}/marks`, {
        query: { arrowSetId: arrowSetId ?? '' },
        signal,
        schema: listSchema,
      }),
  });
}

type Snapshot = { key: ReturnType<typeof marksKey>; before: Mark[] | undefined };

const byDistance = (a: Mark, b: Mark) => a.distanceM - b.distanceM;

/** Reads the cached list of a pair, and writes it back sorted. */
function listOf(client: QueryClient, key: ReturnType<typeof marksKey>): Mark[] | undefined {
  return client.getQueryData<{ items: Mark[] }>(key)?.items;
}
const write = (client: QueryClient, key: ReturnType<typeof marksKey>, items: Mark[]) =>
  client.setQueryData(key, { items: [...items].sort(byDistance) });

/** The version the cache holds for a mark: what `If-Match` must carry. */
export function cachedMark(client: QueryClient, id: string): Mark | undefined {
  for (const [, data] of client.getQueriesData<{ items: Mark[] }>({ queryKey: ['marks'] })) {
    const found = data?.items.find((item) => item.id === id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The marks of the app. Every action shows its result at once (RF-X-04): the list takes the change
 * first, the request follows, and a failure puts the list back as it was. The marks of the Home
 * (the counter on each setup) are refreshed after each one.
 */
export function useMarkActions(setupId: string, arrowSetId: string) {
  const http = useHttp();
  const client = useQueryClient();
  const key = marksKey(setupId, arrowSetId);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: ['setups'] }),
    ]);
  const rollback = (_error: unknown, _variables: unknown, snapshot: Snapshot | undefined) => {
    if (snapshot?.before !== undefined) write(client, snapshot.key, snapshot.before);
  };
  const begin = async (): Promise<Snapshot> => {
    await client.cancelQueries({ queryKey: key });
    return { key, before: listOf(client, key) };
  };

  const create = useMutation({
    scope: { id: `marks-${setupId}` },
    mutationFn: ({ input, idempotencyKey }: { input: CreateMark; idempotencyKey: string }) =>
      http.post('/marks', { body: input, idempotencyKey, schema: mark }),
    onMutate: async ({ input }): Promise<Snapshot> => {
      const snapshot = await begin();
      const now = nowIso();
      const optimistic: Mark = {
        id: input.id,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        setupId: input.setupId,
        arrowSetId: input.arrowSetId,
        distanceM: input.distanceM,
        scaleValueMm: input.scaleValueMm,
        origin: 'measured',
        ...(input.note == null ? {} : { note: input.note }),
        measuredAt: input.measuredAt ?? now,
      };
      const taken = (snapshot.before ?? []).some((item) => item.distanceM === input.distanceM);
      // A distance that already has a mark is a conflict the server will answer (409) and the screen
      // will ask about: two marks at one distance must never reach the list, the model rejects them.
      if (taken && !input.replace) return snapshot;
      const rest = (snapshot.before ?? []).filter(
        // A replacement takes the place of the mark at that distance.
        (item) => item.distanceM !== input.distanceM,
      );
      write(client, key, [...rest, optimistic]);
      return snapshot;
    },
    onError: rollback,
    onSuccess: (saved, { input }) => {
      // The server's copy replaces the guess: same id, or the existing mark that was replaced.
      const items = (listOf(client, key) ?? []).filter(
        (item) => item.id !== input.id && item.id !== saved.id,
      );
      write(client, key, [...items, saved]);
    },
    onSettled: refresh,
  });

  const update = useMutation({
    scope: { id: `marks-${setupId}` },
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMark }) => {
      const version = cachedMark(client, id)?.version;
      return http.patch(`/marks/${encodeURIComponent(id)}`, {
        body: patch,
        schema: mark,
        ...(version === undefined ? {} : { version }),
      });
    },
    onMutate: async ({ id, patch }): Promise<Snapshot> => {
      const snapshot = await begin();
      write(
        client,
        key,
        (snapshot.before ?? []).map((item) =>
          item.id === id
            ? {
                ...item,
                ...(patch.distanceM === undefined ? {} : { distanceM: patch.distanceM }),
                ...(patch.scaleValueMm === undefined ? {} : { scaleValueMm: patch.scaleValueMm }),
                ...(patch.measuredAt === undefined ? {} : { measuredAt: patch.measuredAt }),
              }
            : item,
        ),
      );
      return snapshot;
    },
    onError: rollback,
    onSuccess: (saved) => {
      write(
        client,
        key,
        (listOf(client, key) ?? []).map((item) => (item.id === saved.id ? saved : item)),
      );
    },
    // After success *and* failure: a 412 needs the newer copy, a success needs fresh counters.
    onSettled: refresh,
  });

  const remove = useMutation({
    scope: { id: `marks-${setupId}` },
    // The version travels in the variables: `onMutate` takes the mark out of the cache first.
    mutationFn: async ({ id, version }: { id: string; version: number | undefined }) => {
      await http.delete(`/marks/${encodeURIComponent(id)}`, {
        ...(version === undefined ? {} : { version }),
      });
    },
    onMutate: async ({ id }): Promise<Snapshot> => {
      const snapshot = await begin();
      write(
        client,
        key,
        (snapshot.before ?? []).filter((item) => item.id !== id),
      );
      return snapshot;
    },
    onError: rollback,
    onSettled: refresh,
  });

  const restore = useMutation({
    scope: { id: `marks-${setupId}` },
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      http.post(`/marks/${encodeURIComponent(id)}/restore`, { idempotencyKey, schema: mark }),
    onSuccess: (saved) => write(client, key, [...(listOf(client, key) ?? []), saved]),
    onSettled: refresh,
  });

  return {
    create: create.mutateAsync,
    createState: create,
    update: update.mutateAsync,
    updateState: update,
    remove: ({ id }: { id: string }) =>
      remove.mutateAsync({ id, version: cachedMark(client, id)?.version }),
    removeState: remove,
    restore: (id: string) => restore.mutateAsync({ id, idempotencyKey: http.newIdempotencyKey() }),
    newIdempotencyKey: () => http.newIdempotencyKey(),
  };
}
