import type { HttpClient } from '@sight-mapper/client';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

const SessionSchema = z
  .object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      username: z.string().nullish(),
      emailVerified: z.boolean(),
    }),
  })
  .nullable();

export type SessionData = z.infer<typeof SessionSchema>;

export const sessionKey = ['session'] as const;

/** Who is signed in, or `null`. Query owns it: it is server state, never copied to a store. */
export const sessionQuery = (authHttp: HttpClient) =>
  queryOptions({
    queryKey: sessionKey,
    queryFn: ({ signal }) => authHttp.get('get-session', { schema: SessionSchema, signal }),
    staleTime: 60_000,
  });

/** After sign-in, sign-out or an expired session: the next guard asks the server again. */
export const resetSession = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: sessionKey });
