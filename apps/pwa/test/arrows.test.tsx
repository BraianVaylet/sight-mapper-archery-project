import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ANA, errorEnvelope, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

const PROFILE = {
  locale: 'es',
  unitSystem: 'metric',
  theme: 'system',
  quickAccess: null,
  deletionRequestedAt: null,
  version: 1,
};

const SET_ID = '01927e5a-0000-7000-8000-0000000000d1';
const arrowSet = (over: Record<string, unknown> = {}) => ({
  id: SET_ID,
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
  name: 'Goldtip Hunter 400',
  spine: 400,
  pointWeightG: 6.4799,
  status: 'active',
  ...over,
});

type Handler = (request: Request) => Response | Promise<Response>;

function arrowsServer(
  options: {
    items?: unknown[];
    system?: 'metric' | 'imperial';
    routes?: Record<string, Handler>;
  } = {},
) {
  const sent: { method: string; path: string; body: unknown; headers: Headers }[] = [];
  const record =
    (response: () => Response): Handler =>
    async (request) => {
      const text = await request.text();
      sent.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: text === '' ? undefined : JSON.parse(text),
        headers: request.headers,
      });
      return response();
    };
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () => json({ ...PROFILE, unitSystem: options.system ?? 'metric' }),
    'GET /api/v1/arrow-sets': () => json({ items: options.items ?? [], nextCursor: null }),
    [`GET /api/v1/arrow-sets/${SET_ID}`]: () =>
      json({ ...arrowSet(), usage: { setups: 0, marks: 0 } }),
    'POST /api/v1/arrow-sets': record(() => json(arrowSet(), 201)),
    [`PATCH /api/v1/arrow-sets/${SET_ID}`]: record(() => json(arrowSet({ version: 2 }))),
    [`POST /api/v1/arrow-sets/${SET_ID}/archive`]: record(() =>
      json(arrowSet({ status: 'archived' })),
    ),
    [`DELETE /api/v1/arrow-sets/${SET_ID}`]: record(() => new Response(null, { status: 204 })),
    ...options.routes,
  });
  return { ...api, sent };
}

describe('Your arrows (HU-ARW-01)', () => {
  it('invites the archer to add the first set when there are none', async () => {
    renderApp('/arrows', arrowsServer().fetch);
    expect(await screen.findByText('Todavía no cargaste sets de flechas')).toBeInTheDocument();
  });

  it('lists the sets by name and archives one from the list', async () => {
    const api = arrowsServer({ items: [arrowSet()] });
    renderApp('/arrows', api.fetch);
    expect(await screen.findByRole('heading', { name: 'Goldtip Hunter 400' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/arrow-sets/${SET_ID}/archive`)).toBe(true),
    );
  });

  it('shows an error with a way to retry', async () => {
    const api = arrowsServer({
      routes: {
        'GET /api/v1/arrow-sets': () =>
          errorEnvelope('SM-CORE-404-001', 'errors.core.routeNotFound', 404),
      },
    });
    renderApp('/arrows', api.fetch);
    expect(await screen.findByText('No pudimos cargar tus flechas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('New arrow set', () => {
  const posted = (api: ReturnType<typeof arrowsServer>) =>
    api.sent.find((s) => s.method === 'POST')?.body as Record<string, unknown>;

  it('saves with only a name: everything else stays blank', async () => {
    const api = arrowsServer();
    renderApp('/arrows/new', api.fetch);
    await userEvent.type(await screen.findByLabelText('Nombre corto'), 'Mis flechas');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('heading', { name: 'Flechas' })).toBeInTheDocument();
    expect(posted(api)).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Mis flechas',
    });
    expect(api.sent[0]?.headers.get('idempotency-key')).toBeTruthy();
  });

  it('asks for the name, and sends nothing without it', async () => {
    const api = arrowsServer();
    renderApp('/arrows/new', api.fetch);
    await screen.findByLabelText('Nombre corto');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Completá este campo.')).toBeInTheDocument();
    expect(api.sent).toEqual([]);
  });

  it('keeps the measurements, with a comma as decimal separator, and reads "more details"', async () => {
    const api = arrowsServer();
    renderApp('/arrows/new', api.fetch);
    await userEvent.type(await screen.findByLabelText('Nombre corto'), 'Hunter');
    await userEvent.type(screen.getByLabelText('Spine'), '400');
    await userEvent.type(screen.getByLabelText('Peso de la punta'), '5,6');
    await userEvent.click(screen.getByText('Más datos'));
    await userEvent.type(screen.getByLabelText('Nock'), 'Pin nock');
    await userEvent.type(screen.getByLabelText('Velocidad medida'), '83,2');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(posted(api)).toBeDefined());
    expect(posted(api)).toMatchObject({
      name: 'Hunter',
      spine: 400,
      pointWeightG: 5.6,
      nock: 'Pin nock',
      measuredSpeedMps: 83.2,
    });
  });

  it('says which field is out of range or not a number', async () => {
    const api = arrowsServer();
    renderApp('/arrows/new', api.fetch);
    await userEvent.type(await screen.findByLabelText('Nombre corto'), 'Hunter');
    await userEvent.type(screen.getByLabelText('Spine'), '20');
    await userEvent.type(screen.getByLabelText('GPI'), 'pesado');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingresá un número.')).toBeInTheDocument();
    expect(screen.getByLabelText('Spine')).toHaveAttribute('aria-invalid', 'true');
    expect(api.sent).toEqual([]);
  });

  it('takes grains and fractions of an inch in imperial and stores grams and mm', async () => {
    const api = arrowsServer({ system: 'imperial' });
    renderApp('/arrows/new', api.fetch);
    await userEvent.type(await screen.findByLabelText('Nombre corto'), 'Hunter');
    await userEvent.type(screen.getByLabelText('Largo de corte'), '29 1/8');
    await userEvent.type(screen.getByLabelText('Peso de la punta'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(posted(api)).toBeDefined());
    const body = posted(api) as { cutLengthMm: number; pointWeightG: number };
    expect(body.cutLengthMm).toBeCloseTo(739.775, 2);
    expect(body.pointWeightG).toBeCloseTo(6.4799, 3);
  });
});

describe('Edit arrow set', () => {
  it('opens with the saved values and saves with the version it saw, nulling what was emptied', async () => {
    const api = arrowsServer();
    renderApp(`/arrows/${SET_ID}`, api.fetch);
    expect(await screen.findByLabelText('Nombre corto')).toHaveValue('Goldtip Hunter 400');
    expect(screen.getByLabelText('Peso de la punta')).toHaveValue('6,48');

    await userEvent.clear(screen.getByLabelText('Spine'));
    await userEvent.type(screen.getByLabelText('GPI'), '8,5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.sent.find((s) => s.method === 'PATCH')).toBeDefined());
    const patch = api.sent.find((s) => s.method === 'PATCH');
    expect(patch?.headers.get('if-match')).toBe('"1"');
    expect(patch?.body).toMatchObject({ name: 'Goldtip Hunter 400', spine: null, gpi: 8.5 });
    expect(patch?.body).not.toHaveProperty('id');
    expect(patch?.body).not.toHaveProperty('name', null);
  });

  it('offers to archive when setups use the set (SM-ARW-409-001, HU-EQP-01)', async () => {
    const api = arrowsServer({
      routes: {
        [`DELETE /api/v1/arrow-sets/${SET_ID}`]: () =>
          json(
            {
              success: false,
              error: {
                code: 'SM-ARW-409-001',
                messageKey: 'errors.equipment.inUse',
                params: { setups: 2, marks: 14 },
                requestId: 'r1',
                timestamp: '2026-11-02T12:00:00Z',
              },
            },
            409,
          ),
      },
    });
    renderApp(`/arrows/${SET_ID}`, api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar este set' }));
    const sheet = screen.getByRole('dialog', { name: '¿Borrar este set?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Borrar' }));
    expect(
      await within(sheet).findByText('Está en uso en 2 setups y 14 marcas. Podés archivarlo.'),
    ).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Archivar en su lugar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/arrow-sets/${SET_ID}/archive`)).toBe(true),
    );
  });

  it('deletes a set nothing uses, after asking', async () => {
    const api = arrowsServer();
    renderApp(`/arrows/${SET_ID}`, api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar este set' }));
    const sheet = screen.getByRole('dialog', { name: '¿Borrar este set?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(api.sent.some((s) => s.method === 'DELETE')).toBe(true));
    expect(api.sent.find((s) => s.method === 'DELETE')?.headers.get('if-match')).toBe('"1"');
  });
});
