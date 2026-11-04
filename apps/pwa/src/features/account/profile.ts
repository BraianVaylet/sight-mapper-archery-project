import { isApiError, useHttp } from '@sight-mapper/client';
import {
  profile,
  type Profile,
  type QuickAccess,
  type UpdatePreferences,
} from '@sight-mapper/schemas';
import type { UnitSystem } from '@sight-mapper/types';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const profileKey = ['me'] as const;

/** The signed-in archer's profile. Server state: Query owns it, no store copies it. */
export const profileQuery = (http: ReturnType<typeof useHttp>) =>
  queryOptions({
    queryKey: profileKey,
    queryFn: ({ signal }) => http.get('/me', { schema: profile, signal }),
    staleTime: 5 * 60_000,
  });

/** The archer's unit system; metric until the profile arrives. */
export function useUnitSystem(): UnitSystem {
  const http = useHttp();
  return useQuery(profileQuery(http)).data?.unitSystem ?? 'metric';
}

const versionOf = (current: Profile | undefined) =>
  current === undefined ? {} : { version: current.version };

/**
 * Changes preferences with the screen first: the cache takes the new value at once, the PATCH
 * follows with the version the cache holds as `If-Match`, and a failure puts the old values back.
 * Changes go one after another (`scope`), so each one carries the version the previous one made.
 */
export function useUpdatePreferences() {
  const http = useHttp();
  const queryClient = useQueryClient();

  return useMutation({
    scope: { id: 'preferences' },
    mutationFn: (patch: UpdatePreferences) =>
      http.patch('/me/preferences', {
        body: patch,
        schema: profile,
        ...versionOf(queryClient.getQueryData<Profile>(profileKey)),
      }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: profileKey });
      const previous = queryClient.getQueryData<Profile>(profileKey);
      if (previous !== undefined) queryClient.setQueryData(profileKey, { ...previous, ...patch });
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(profileKey, context.previous);
      // Someone else changed it first: take their version so the next try can win.
      if (isApiError(error) && error.status === 412) {
        void queryClient.invalidateQueries({ queryKey: profileKey });
      }
    },
    onSuccess: (updated) => queryClient.setQueryData(profileKey, updated),
  });
}

/** What the app opens on, or `null`. Server state: it is read from the profile, never copied. */
export function useQuickAccess(): QuickAccess | null | undefined {
  const http = useHttp();
  return useQuery(profileQuery(http)).data?.quickAccess;
}

/**
 * "Always open here" (HU-STP-03): the cache shows the new pair at once, `PUT /me/quick-access`
 * follows with the version the cache holds, and a failure puts the old one back. It shares the
 * scope of the preferences: both change the same profile, so each must carry the version the
 * previous one made.
 */
export function useSetQuickAccess() {
  const http = useHttp();
  const queryClient = useQueryClient();

  return useMutation({
    scope: { id: 'preferences' },
    mutationFn: (quickAccess: QuickAccess | null) =>
      http.put('/me/quick-access', {
        body: quickAccess,
        schema: profile,
        ...versionOf(queryClient.getQueryData<Profile>(profileKey)),
      }),
    onMutate: async (quickAccess) => {
      await queryClient.cancelQueries({ queryKey: profileKey });
      const previous = queryClient.getQueryData<Profile>(profileKey);
      if (previous !== undefined)
        queryClient.setQueryData(profileKey, { ...previous, quickAccess });
      return { previous };
    },
    onError: (error, _quickAccess, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(profileKey, context.previous);
      // Someone else changed it first, or the setup is gone: read the profile again.
      if (isApiError(error)) void queryClient.invalidateQueries({ queryKey: profileKey });
    },
    onSuccess: (updated) => queryClient.setQueryData(profileKey, updated),
  });
}

/**
 * Asks for the account to be deleted in `DELETION_DAYS` days (HU-ACC-06). Nothing is removed now.
 * The profile that comes back carries the date; it goes in the cache and the screen shows it.
 */
export function useRequestDeletion() {
  const http = useHttp();
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: 'preferences' },
    mutationFn: () => http.post('/me/deletion-request', { schema: profile }),
    onSuccess: (updated) => queryClient.setQueryData(profileKey, updated),
    onError: () => void queryClient.invalidateQueries({ queryKey: profileKey }),
  });
}

/** Withdraws the request. No `If-Match`: the way out must work whatever else changed in the profile. */
export function useCancelDeletion() {
  const http = useHttp();
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: 'preferences' },
    mutationFn: () => http.delete('/me/deletion-request', { schema: profile }),
    onSuccess: (updated) => queryClient.setQueryData(profileKey, updated),
    onError: () => void queryClient.invalidateQueries({ queryKey: profileKey }),
  });
}
