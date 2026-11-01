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

/**
 * A `fetch` that answers by `METHOD /path`. A request nobody planned fails the test loudly
 * instead of reaching a real network.
 */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    calls.push(key);
    const handler = routes[key];
    if (handler === undefined) throw new Error(`unplanned request: ${key}`);
    return handler(request);
  };
  return { fetch: impl, calls };
}
