import type { HttpClient } from '@sight-mapper/client';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import * as z from 'zod/mini';

// zod/mini: the guards run on the first screen, and the classic API does not tree-shake.
const SessionSchema = z.nullable(
  z.object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      username: z.nullish(z.string()),
      emailVerified: z.boolean(),
    }),
  }),
);

export type SessionData = z.infer<typeof SessionSchema>;

export const sessionKey = ['session'] as const;

/** Who is signed in, or `null`. Query owns it: it is server state, never copied to a store. */
export const sessionQuery = (authHttp: HttpClient) =>
  queryOptions({
    queryKey: sessionKey,
    queryFn: ({ signal }) => authHttp.get('get-session', { schema: SessionSchema, signal }),
    staleTime: 60_000,
  });

/**
 * Forgets who was signed in (sign-in, sign-out, an expired session): the next guard asks the server.
 * Removed, not just invalidated: `ensureQueryData` serves stale data without asking again.
 */
export const forgetSession = (queryClient: QueryClient) =>
  queryClient.removeQueries({ queryKey: sessionKey });
