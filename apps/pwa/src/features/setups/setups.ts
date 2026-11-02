import { createResourceHooks, useHttp, type Page } from '@sight-mapper/client';
import {
  setupView,
  trashedSetupView,
  type CreateSetup,
  type SetupView,
  type UpdateSetup,
} from '@sight-mapper/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

/** Every call to `/setups` (list, detail, add, edit, archive, send to the trash) from one factory. */
export const setupHooks = createResourceHooks<SetupView, CreateSetup, UpdateSetup>({
  name: 'setups',
  path: '/setups',
  schema: setupView,
});

export const trashKey = ['setups', 'trash'] as const;

const trashSchema = z.object({ items: z.array(trashedSetupView) });

/** The trash: setups deleted in the last 30 days and the day each is purged for good. */
export function useTrash() {
  const http = useHttp();
  return useQuery({
    queryKey: trashKey,
    queryFn: ({ signal }) => http.get('/setups/trash', { signal, schema: trashSchema }),
  });
}

/** Takes a setup out of the trash; both the Home and the trash change. */
export function useRestore() {
  const client = useQueryClient();
  const action = setupHooks.useAction();
  return {
    ...action,
    restore: async (id: string) => {
      const restored = await action.run(id, 'restore');
      await client.invalidateQueries({ queryKey: trashKey });
      return restored;
    },
  };
}

/** Sending a setup to the trash also changes the trash. */
export function useSendToTrash() {
  const client = useQueryClient();
  const remove = setupHooks.useRemove();
  return {
    ...remove,
    sendToTrash: async (id: string) => {
      await remove.mutateAsync({ id });
      await client.invalidateQueries({ queryKey: trashKey });
    },
  };
}

type Snapshot = [readonly unknown[], Page<SetupView> | undefined][];

/**
 * The star on a card (HU-STP-02): the list shows it at once, the PATCH follows behind with the
 * version the cache holds when its turn comes, and a failure puts every list back. Toggles go one
 * after another so the second never carries the version the first has already used.
 */
export function useToggleFavorite() {
  const http = useHttp();
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'setup-favorite' },
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const version = setupHooks.cachedVersion(client, id);
      return http.patch(`/setups/${encodeURIComponent(id)}`, {
        body: { isFavorite },
        schema: setupView,
        ...(version === undefined ? {} : { version }),
      });
    },
    onMutate: async ({ id, isFavorite }): Promise<{ snapshots: Snapshot }> => {
      await client.cancelQueries({ queryKey: setupHooks.keys.lists });
      const snapshots: Snapshot = client.getQueriesData<Page<SetupView>>({
        queryKey: setupHooks.keys.lists,
      });
      for (const [key, page] of snapshots) {
        if (page === undefined) continue;
        client.setQueryData(key, {
          ...page,
          items: page.items.map((item) => (item.id === id ? { ...item, isFavorite } : item)),
        });
      }
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, page] of context?.snapshots ?? []) client.setQueryData(key, page);
    },
    // After success *and* failure: the order (favourites first) and the versions come from the server.
    onSettled: () => client.invalidateQueries({ queryKey: setupHooks.keys.lists }),
  });
}
