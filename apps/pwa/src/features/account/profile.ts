import { isApiError, useHttp } from '@sight-mapper/client';
import {
  DEFAULT_UNITS,
  type Profile,
  type QuickAccess,
  type UpdatePreferences,
  type Units,
} from '@sight-mapper/schemas';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const profileKey = ['me'] as const;

/**
 * The profile schema, loaded by the first request that needs it. It is classic Zod, and the shell
 * imports this module to paint the first screen (TECNICO §14).
 */
const profileSchema = () => import('@sight-mapper/schemas').then((schemas) => schemas.profile);

/** The signed-in archer's profile. Server state: Query owns it, no store copies it. */
export const profileQuery = (http: ReturnType<typeof useHttp>) =>
  queryOptions({
    queryKey: profileKey,
    queryFn: async ({ signal }) => http.get('/me', { schema: await profileSchema(), signal }),
    staleTime: 5 * 60_000,
  });

/**
 * The archer's unit system of each section (RF-ACC-04); the defaults of a new archer until the
 * profile arrives. Each screen takes the section it shows: `marks` for distances, `bow`, `arrows`,
 * `sight` for the scale a new sight starts on.
 */
export function useUnits(): Units {
  const http = useHttp();
  return useQuery(profileQuery(http)).data?.units ?? DEFAULT_UNITS;
}

/** The profile with a patch applied, as the cache shows it before the server answers. */
export function withPatch(current: Profile, patch: UpdatePreferences): Profile {
  const units = { ...current.units };
  for (const [section, system] of Object.entries(patch.units ?? {}) as [
    keyof Units,
    Units[keyof Units] | undefined,
  ][]) {
    if (system !== undefined) units[section] = system;
  }
  return {
    ...current,
    locale: patch.locale ?? current.locale,
    theme: patch.theme ?? current.theme,
    units,
    // `null` is a value: it puts the default back.
    doctorToleranceMm:
      patch.doctorToleranceMm === undefined ? current.doctorToleranceMm : patch.doctorToleranceMm,
  };
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
    mutationFn: async (patch: UpdatePreferences) =>
      http.patch('/me/preferences', {
        body: patch,
        schema: await profileSchema(),
        ...versionOf(queryClient.getQueryData<Profile>(profileKey)),
      }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: profileKey });
      const previous = queryClient.getQueryData<Profile>(profileKey);
      if (previous !== undefined) queryClient.setQueryData(profileKey, withPatch(previous, patch));
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
    mutationFn: async (quickAccess: QuickAccess | null) =>
      http.put('/me/quick-access', {
        body: quickAccess,
        schema: await profileSchema(),
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
    mutationFn: async () => http.post('/me/deletion-request', { schema: await profileSchema() }),
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
    mutationFn: async () => http.delete('/me/deletion-request', { schema: await profileSchema() }),
    onSuccess: (updated) => queryClient.setQueryData(profileKey, updated),
    onError: () => void queryClient.invalidateQueries({ queryKey: profileKey }),
  });
}
