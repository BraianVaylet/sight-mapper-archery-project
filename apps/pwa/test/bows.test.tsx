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

const BOW_ID = '01927e5a-0000-7000-8000-0000000000b1';
const bow = (over: Record<string, unknown> = {}) => ({
  id: BOW_ID,
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
  bowType: 'compound',
  manufacturer: 'Hoyt',
  model: 'Alpha',
  letOffPct: 80,
  braceHeightMm: 158.75,
  status: 'active',
  ...over,
});

type Handler = (request: Request) => Response | Promise<Response>;

function bowsServer(
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
    'GET /api/v1/bows': () => json({ items: options.items ?? [], nextCursor: null }),
    [`GET /api/v1/bows/${BOW_ID}`]: () => json({ ...bow(), usage: { setups: 0, marks: 0 } }),
    'POST /api/v1/bows': record(() => json(bow(), 201)),
    [`PATCH /api/v1/bows/${BOW_ID}`]: record(() => json(bow({ version: 2 }))),
    [`POST /api/v1/bows/${BOW_ID}/archive`]: record(() => json(bow({ status: 'archived' }))),
    [`DELETE /api/v1/bows/${BOW_ID}`]: record(() => new Response(null, { status: 204 })),
    ...options.routes,
  });
  return { ...api, sent };
}

describe('Your bows (HU-BOW-01)', () => {
  it('invites the archer to add the first one when there are none', async () => {
    renderApp('/bows', bowsServer().fetch);
    expect(await screen.findByText('Todavía no cargaste arcos')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nuevo arco' }).length).toBeGreaterThan(0);
  });

  it('lists the bows by name with their last edit, and archives one from the list', async () => {
    const api = bowsServer({ items: [bow()] });
    renderApp('/bows', api.fetch);
    expect(await screen.findByRole('heading', { name: 'Hoyt Alpha' })).toBeInTheDocument();
    expect(screen.getByText(/Editado/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/bows/${BOW_ID}/archive`)).toBe(true),
    );
    const archive = api.sent.find((s) => s.path.endsWith('/archive'));
    expect(archive?.headers.get('idempotency-key')).toBeTruthy();
  });

  it('shows the nickname before the maker and the model', async () => {
    renderApp('/bows', bowsServer({ items: [bow({ nickname: 'La de caza' })] }).fetch);
    expect(await screen.findByRole('heading', { name: 'La de caza' })).toBeInTheDocument();
  });

  it('shows an error with a way to retry, never a blank screen', async () => {
    const api = bowsServer({
      routes: {
        'GET /api/v1/bows': () =>
          errorEnvelope('SM-CORE-404-001', 'errors.core.routeNotFound', 404),
      },
    });
    renderApp('/bows', api.fetch);
    expect(await screen.findByText('No pudimos cargar tus arcos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('New bow', () => {
  const open = async (api: ReturnType<typeof bowsServer>) => {
    renderApp('/bows/new', api.fetch);
    await screen.findByLabelText('Fabricante');
  };

  it('adds a bow with a client id, one idempotency key and canonical units', async () => {
    const api = bowsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Fabricante'), 'Hoyt');
    await userEvent.type(screen.getByLabelText('Modelo'), 'Alpha');
    await userEvent.type(screen.getByLabelText('Brace height'), '158,75');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('heading', { name: 'Arcos' })).toBeInTheDocument();
    const post = api.sent.find((s) => s.method === 'POST');
    expect(post?.body).toMatchObject({
      bowType: 'compound',
      manufacturer: 'Hoyt',
      model: 'Alpha',
      braceHeightMm: 158.75,
    });
    expect((post?.body as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
    expect(post?.headers.get('idempotency-key')).toBeTruthy();
  });

  it('asks for a maker or a model before sending anything', async () => {
    const api = bowsServer();
    await open(api);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingresá el fabricante o el modelo.')).toBeInTheDocument();
    expect(api.sent).toEqual([]);
  });

  it('says which field holds a value that is out of range', async () => {
    const api = bowsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Modelo'), 'Alpha');
    await userEvent.type(screen.getByLabelText('Let-off'), '120');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByLabelText('Let-off')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(screen.getByLabelText('Let-off')).toHaveAccessibleDescription(/99/));
    expect(api.sent).toEqual([]);
  });

  it('says a word is not a number, on that field', async () => {
    await open(bowsServer());
    await userEvent.type(screen.getByLabelText('Modelo'), 'Alpha');
    await userEvent.type(screen.getByLabelText('Libraje'), 'mucho');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingresá un número.')).toBeInTheDocument();
  });

  it('takes imperial values with fractions: 6 1/4 in is stored as 158.75 mm', async () => {
    const api = bowsServer({ system: 'imperial' });
    renderApp('/bows/new', api.fetch);
    const brace = await screen.findByLabelText('Brace height');
    await waitFor(() => expect(screen.getAllByText('in').length).toBeGreaterThan(0));
    await userEvent.type(screen.getByLabelText('Modelo'), 'Alpha');
    await userEvent.type(brace, '6 1/4');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.sent.find((s) => s.method === 'POST')).toBeDefined());
    expect(api.sent.find((s) => s.method === 'POST')?.body).toMatchObject({
      braceHeightMm: 158.75,
    });
  });
});

describe('Edit bow', () => {
  it('opens with the saved values and what uses the bow', async () => {
    const api = bowsServer({
      routes: {
        [`GET /api/v1/bows/${BOW_ID}`]: () => json({ ...bow(), usage: { setups: 2, marks: 14 } }),
      },
    });
    renderApp(`/bows/${BOW_ID}`, api.fetch);
    expect(await screen.findByLabelText('Fabricante')).toHaveValue('Hoyt');
    expect(screen.getByLabelText('Brace height')).toHaveValue('158,75');
    expect(screen.getByText('Se usa en 2 setups y 14 marcas.')).toBeInTheDocument();
  });

  it('saves with the version it saw and clears what was emptied', async () => {
    const api = bowsServer();
    renderApp(`/bows/${BOW_ID}`, api.fetch);
    const letOff = await screen.findByLabelText('Let-off');
    await userEvent.clear(letOff);
    await userEvent.type(screen.getByLabelText('Apodo'), 'Caza');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.sent.find((s) => s.method === 'PATCH')).toBeDefined());
    const patch = api.sent.find((s) => s.method === 'PATCH');
    expect(patch?.headers.get('if-match')).toBe('"1"');
    expect(patch?.body).toMatchObject({ nickname: 'Caza', letOffPct: null, manufacturer: 'Hoyt' });
    expect(patch?.body).not.toHaveProperty('id');
  });

  it('deletes a bow nothing uses, after asking', async () => {
    const api = bowsServer();
    renderApp(`/bows/${BOW_ID}`, api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar este arco' }));
    const sheet = screen.getByRole('dialog', { name: '¿Borrar este arco?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(api.sent.some((s) => s.method === 'DELETE')).toBe(true));
    expect(api.sent.find((s) => s.method === 'DELETE')?.headers.get('if-match')).toBe('"1"');
  });

  it('offers to archive when setups use the bow (SM-BOW-409-001, HU-EQP-01)', async () => {
    const api = bowsServer({
      routes: {
        [`DELETE /api/v1/bows/${BOW_ID}`]: () =>
          json(
            {
              success: false,
              error: {
                code: 'SM-BOW-409-001',
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
    renderApp(`/bows/${BOW_ID}`, api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar este arco' }));
    const sheet = screen.getByRole('dialog', { name: '¿Borrar este arco?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Borrar' }));

    expect(
      await within(sheet).findByText('Está en uso en 2 setups y 14 marcas. Podés archivarlo.'),
    ).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Archivar en su lugar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/bows/${BOW_ID}/archive`)).toBe(true),
    );
  });
});
