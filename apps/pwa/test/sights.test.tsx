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

const SIGHT_ID = '01927e5a-0000-7000-8000-0000000000c1';
const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };
const sight = (over: Record<string, unknown> = {}) => ({
  id: SIGHT_ID,
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
  manufacturer: 'Sight Master',
  model: 'Ultraview',
  pinType: 'monopin',
  scale: SCALE,
  status: 'active',
  ...over,
});

type Handler = (request: Request) => Response | Promise<Response>;

function sightsServer(options: { items?: unknown[]; routes?: Record<string, Handler> } = {}) {
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
    'GET /api/v1/me': () => json(PROFILE),
    'GET /api/v1/sights': () => json({ items: options.items ?? [], nextCursor: null }),
    [`GET /api/v1/sights/${SIGHT_ID}`]: () => json({ ...sight(), usage: { setups: 0, marks: 0 } }),
    'POST /api/v1/sights': record(() => json(sight(), 201)),
    [`PATCH /api/v1/sights/${SIGHT_ID}`]: record(() => json(sight({ version: 2 }))),
    [`POST /api/v1/sights/${SIGHT_ID}/archive`]: record(() => json(sight({ status: 'archived' }))),
    [`DELETE /api/v1/sights/${SIGHT_ID}`]: record(() => new Response(null, { status: 204 })),
    ...options.routes,
  });
  return { ...api, sent };
}

const conflict = (code: string, messageKey: string, params: Record<string, unknown>) =>
  json(
    {
      success: false,
      error: { code, messageKey, params, requestId: 'r1', timestamp: '2026-11-02T12:00:00Z' },
    },
    409,
  );

describe('Your sights', () => {
  it('invites the archer to add the first one', async () => {
    renderApp('/sights', sightsServer().fetch);
    expect(await screen.findByText('Todavía no cargaste miras')).toBeInTheDocument();
  });

  it('lists each sight with its scale and archives one from the list', async () => {
    const api = sightsServer({ items: [sight()] });
    renderApp('/sights', api.fetch);
    expect(
      await screen.findByRole('heading', { name: 'Sight Master Ultraview' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Escala: 0 a 10 cm/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/sights/${SIGHT_ID}/archive`)).toBe(true),
    );
  });

  it('shows an error with a way to retry', async () => {
    const api = sightsServer({
      routes: {
        'GET /api/v1/sights': () =>
          errorEnvelope('SM-CORE-404-001', 'errors.core.routeNotFound', 404),
      },
    });
    renderApp('/sights', api.fetch);
    expect(await screen.findByText('No pudimos cargar tus miras')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('New sight (HU-SGT-01)', () => {
  const open = async (api: ReturnType<typeof sightsServer>) => {
    renderApp('/sights/new', api.fetch);
    await screen.findByLabelText('Modelo');
  };
  const fillScale = async (min: string, max: string, step: string) => {
    await userEvent.type(screen.getByLabelText('Mínimo'), min);
    await userEvent.type(screen.getByLabelText('Máximo'), max);
    await userEvent.type(screen.getByLabelText('Paso más chico'), step);
  };
  const posted = (api: ReturnType<typeof sightsServer>) =>
    api.sent.find((s) => s.method === 'POST')?.body as Record<string, unknown>;

  it('saves the author sight: cm from 0 to 10 in steps of 0.1, with a ruler preview', async () => {
    const api = sightsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Modelo'), 'Ultraview');
    await fillScale('0', '10', '0,1');
    expect(
      await screen.findByRole('img', { name: /Vista previa de la escala/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Recorrido: 100 mm')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('heading', { name: 'Miras' })).toBeInTheDocument();
    expect(posted(api)).toMatchObject({
      pinType: 'monopin',
      model: 'Ultraview',
      scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
    });
    expect(api.sent[0]?.headers.get('idempotency-key')).toBeTruthy();
  });

  it('works out the unit size from the physical length: 1 to 9 over 80 mm is 10 mm', async () => {
    const api = sightsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Modelo'), 'Custom');
    await userEvent.selectOptions(screen.getByLabelText('Unidad de la escala'), 'custom');
    await fillScale('1', '9', '0,5');
    await userEvent.type(screen.getByLabelText('Largo entre mínimo y máximo'), '80');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(posted(api)).toBeDefined());
    expect(posted(api)['scale']).toMatchObject({ unit: 'custom', unitSizeMm: 10 });
  });

  it('lets a click scale be saved without a size, warning that the tape will not be to scale', async () => {
    const api = sightsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Modelo'), 'Clicks');
    await userEvent.selectOptions(screen.getByLabelText('Unidad de la escala'), 'click');
    await fillScale('0', '100', '1');
    expect(
      screen.getByText('Sin tamaño de unidad: el tape a escala no va a estar disponible.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(posted(api)).toBeDefined());
    expect(posted(api)['scale']).not.toHaveProperty('unitSizeMm');
  });

  it('keeps the direction the archer picks: growing upward', async () => {
    const api = sightsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Modelo'), 'Up');
    await fillScale('0', '10', '1');
    await userEvent.click(screen.getByRole('radio', { name: 'Crece hacia arriba' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(posted(api)).toBeDefined());
    expect(posted(api)['scale']).toMatchObject({ direction: 'up' });
  });

  it('puts "minimum not below maximum" on the maximum, and sends nothing', async () => {
    const api = sightsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Modelo'), 'Bad');
    await fillScale('10', '5', '1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El máximo debe ser mayor que el mínimo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Máximo')).toHaveAttribute('aria-invalid', 'true');
    expect(api.sent).toEqual([]);
  });

  it('does not draw a preview for numbers that make no scale', async () => {
    await open(sightsServer());
    await fillScale('10', '5', '1');
    expect(screen.queryByRole('img', { name: /Vista previa/ })).toBeNull();
  });
});

describe('Edit sight', () => {
  it('opens with the saved values and saves with the version it saw', async () => {
    const api = sightsServer();
    renderApp(`/sights/${SIGHT_ID}`, api.fetch);
    expect(await screen.findByLabelText('Modelo')).toHaveValue('Ultraview');
    expect(screen.getByLabelText('Máximo')).toHaveValue('10');
    expect(screen.getByLabelText('Paso más chico')).toHaveValue('0,1');

    await userEvent.type(screen.getByLabelText('Apodo'), 'Caza');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.sent.find((s) => s.method === 'PATCH')).toBeDefined());
    const patch = api.sent.find((s) => s.method === 'PATCH');
    expect(patch?.headers.get('if-match')).toBe('"1"');
    expect(patch?.body).toMatchObject({ nickname: 'Caza', scale: { unit: 'cm', max: 10 } });
    expect(patch?.body).not.toHaveProperty('id');
    expect(patch?.body).not.toHaveProperty('scaleChangeStrategy');
  });

  it('asks what to keep when the marks need it, then sends the choice (HU-SGT-02)', async () => {
    let attempts = 0;
    const api = sightsServer({
      routes: {
        [`PATCH /api/v1/sights/${SIGHT_ID}`]: async (request) => {
          attempts += 1;
          const body = (await request.clone().json()) as Record<string, unknown>;
          api.sent.push({
            method: 'PATCH',
            path: new URL(request.url).pathname,
            body,
            headers: request.headers,
          });
          return body['scaleChangeStrategy'] === undefined
            ? conflict('SM-SGT-409-003', 'errors.sight.scaleChangeNeedsStrategy', { marks: 6 })
            : json(sight({ version: 2 }));
        },
      },
    });
    renderApp(`/sights/${SIGHT_ID}`, api.fetch);
    await screen.findByLabelText('Modelo');
    await userEvent.selectOptions(screen.getByLabelText('Unidad de la escala'), 'mm');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const sheet = await screen.findByRole('dialog', {
      name: 'Cambiaste el significado de la escala',
    });
    expect(
      within(sheet).getByText('Esta mira tiene 6 marcas. ¿Qué querés conservar?'),
    ).toBeInTheDocument();
    await userEvent.click(
      within(sheet).getByRole('button', { name: 'Las lecturas que anoté (recomendado)' }),
    );

    await waitFor(() => expect(attempts).toBe(2));
    expect(api.sent.at(-1)?.body).toMatchObject({
      scaleChangeStrategy: 'keepReadings',
      scale: { unit: 'mm' },
    });
  });

  it('shows a scale change that would leave marks off, as an error (SM-SGT-409-002)', async () => {
    const api = sightsServer({
      routes: {
        [`PATCH /api/v1/sights/${SIGHT_ID}`]: () =>
          conflict('SM-SGT-409-002', 'errors.sight.marksOutOfRange', {
            count: 2,
            min: 0,
            max: 5,
          }),
      },
    });
    renderApp(`/sights/${SIGHT_ID}`, api.fetch);
    const max = await screen.findByLabelText('Máximo');
    await userEvent.clear(max);
    await userEvent.type(max, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '2 marcas quedarían fuera de la escala',
    );
  });

  it('offers to archive when setups use the sight (SM-SGT-409-001)', async () => {
    const api = sightsServer({
      routes: {
        [`DELETE /api/v1/sights/${SIGHT_ID}`]: () =>
          conflict('SM-SGT-409-001', 'errors.equipment.inUse', { setups: 2, marks: 14 }),
      },
    });
    renderApp(`/sights/${SIGHT_ID}`, api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar esta mira' }));
    const sheet = screen.getByRole('dialog', { name: '¿Borrar esta mira?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Borrar' }));
    expect(
      await within(sheet).findByText('Está en uso en 2 setups y 14 marcas. Podés archivarlo.'),
    ).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Archivar en su lugar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/sights/${SIGHT_ID}/archive`)).toBe(true),
    );
  });
});
