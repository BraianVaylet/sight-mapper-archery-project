type Handler = (request: Request) => Response | Promise<Response>;

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const errorEnvelope = (
  code: string,
  messageKey: string,
  status: number,
  requestId = 'req-1',
) =>
  json(
    {
      success: false,
      error: { code, messageKey, params: {}, requestId, timestamp: '2026-11-01T12:00:00Z' },
    },
    status,
  );

export const ANA = {
  user: { id: 'u1', email: 'ana@example.com', name: 'Ana', username: 'ana', emailVerified: true },
  session: { id: 's1' },
};

/** A route key with a `*` matches any one path segment: ids the client makes up cannot be listed. */
const matchesWildcard = (pattern: string, key: string): boolean =>
  pattern.includes('*') &&
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')}$`).test(
    key,
  );

/**
 * A `fetch` that answers by `METHOD /path`. A request nobody planned fails the test loudly
 * instead of reaching a real network. An exact key wins; otherwise a key with `*` may match.
 */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    calls.push(key);
    const handler =
      routes[key] ?? Object.entries(routes).find(([pattern]) => matchesWildcard(pattern, key))?.[1];
    if (handler === undefined) throw new Error(`unplanned request: ${key}`);
    return handler(request);
  };
  return { fetch: impl, calls };
}
