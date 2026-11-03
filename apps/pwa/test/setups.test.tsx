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
const SIGHT_ID = '01927e5a-0000-7000-8000-0000000000c1';
const ARROW_ID = '01927e5a-0000-7000-8000-0000000000d1';
const ARROW_2 = '01927e5a-0000-7000-8000-0000000000d2';
const SETUP_ID = '01927e5a-0000-7000-8000-0000000000e1';
const SETUP_2 = '01927e5a-0000-7000-8000-0000000000e2';
const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };
const STAMPS = {
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
};

const bow = (over: Record<string, unknown> = {}) => ({
  id: BOW_ID,
  ...STAMPS,
  bowType: 'compound',
  manufacturer: 'Hoyt',
  model: 'Alpha',
  status: 'active',
  ...over,
});
const sight = (over: Record<string, unknown> = {}) => ({
  id: SIGHT_ID,
  ...STAMPS,
  model: 'Ultraview',
  pinType: 'dualpin',
  scale: SCALE,
  status: 'active',
  ...over,
});
const arrows = (id = ARROW_ID, name = 'Hunter 400') => ({
  id,
  ...STAMPS,
  name,
  status: 'active',
});

const bowRef = { id: BOW_ID, status: 'active', manufacturer: 'Hoyt', model: 'Alpha' };
const sightRef = {
  id: SIGHT_ID,
  status: 'active',
  model: 'Ultraview',
  pinType: 'dualpin',
  scale: SCALE,
};
const setup = (over: Record<string, unknown> = {}) => ({
  id: SETUP_ID,
  ...STAMPS,
  bowId: BOW_ID,
  sightId: SIGHT_ID,
  arrowSetIds: [ARROW_ID],
  isFavorite: false,
  status: 'active',
  bow: bowRef,
  sight: sightRef,
  arrowSets: [{ id: ARROW_ID, status: 'active', name: 'Hunter 400' }],
  marksCount: 0,
  ...over,
});

type Handler = (request: Request) => Response | Promise<Response>;
type Sent = { method: string; path: string; body: unknown; headers: Headers };

function setupsServer(
  options: {
    setups?: unknown[];
    trash?: unknown[];
    bows?: unknown[];
    sights?: unknown[];
    arrowSets?: unknown[];
    routes?: Record<string, Handler>;
  } = {},
) {
  const sent: Sent[] = [];
  // The server remembers the star, as the real one does: a refetch must not undo it.
  let favorite = false;
  const record =
    (response: (request: Request) => Response): Handler =>
    async (request) => {
      const text = await request.clone().text();
      sent.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: text === '' ? undefined : JSON.parse(text),
        headers: request.headers,
      });
      return response(request);
    };
  const page = (items: unknown[]) => () => json({ items, nextCursor: null });
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () => json(PROFILE),
    'GET /api/v1/setups': () =>
      json({
        items: ((options.setups ?? []) as Record<string, unknown>[]).map((s) => ({
          ...s,
          isFavorite: favorite || s['isFavorite'],
        })),
        nextCursor: null,
      }),
    'GET /api/v1/setups/trash': () => json({ items: options.trash ?? [] }),
    'GET /api/v1/bows': page(options.bows ?? [bow()]),
    'GET /api/v1/sights': page(options.sights ?? [sight()]),
    'GET /api/v1/arrow-sets': page(options.arrowSets ?? [arrows(), arrows(ARROW_2, 'Pierce 400')]),
    [`GET /api/v1/setups/${SETUP_ID}`]: () => json(setup()),
    'POST /api/v1/setups': record(() => json(setup({ id: SETUP_2, name: 'Torneo' }), 201)),
    // Saving opens the sight screen of the new setup: its detail and its (empty) marks.
    // (the id is the one the client made up, hence the wildcard)
    'GET /api/v1/setups/*': () => json(setup({ id: SETUP_2, name: 'Torneo' })),
    'GET /api/v1/setups/*/marks': () => json({ items: [] }),
    [`PATCH /api/v1/setups/${SETUP_ID}`]: async (request) => {
      const body = (await request.clone().json()) as { isFavorite?: boolean };
      sent.push({
        method: 'PATCH',
        path: new URL(request.url).pathname,
        body,
        headers: request.headers,
      });
      if (typeof body.isFavorite === 'boolean') favorite = body.isFavorite;
      return json(setup({ version: 2, isFavorite: favorite }));
    },
    [`DELETE /api/v1/setups/${SETUP_ID}`]: record(() => new Response(null, { status: 204 })),
    [`POST /api/v1/setups/${SETUP_ID}/archive`]: record(() => json(setup({ status: 'archived' }))),
    [`POST /api/v1/setups/${SETUP_ID}/restore`]: record(() => json(setup())),
    ...options.routes,
  });
  return { ...api, sent };
}

const conflict = (
  code: string,
  messageKey: string,
  params: Record<string, unknown>,
  status = 409,
) =>
  json(
    {
      success: false,
      error: { code, messageKey, params, requestId: 'r1', timestamp: '2026-11-02T12:00:00Z' },
    },
    status,
  );

describe('Your setups: the Home (HU-STP-02)', () => {
  it('invites the archer to build the first setup', async () => {
    renderApp('/', setupsServer().fetch);
    expect(await screen.findByText('Todavía no tenés setups')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nuevo setup' }).length).toBeGreaterThan(0);
  });

  it('shows each setup with its bow, sight and pin, arrows, marks and last edit', async () => {
    renderApp('/', setupsServer({ setups: [setup({ name: 'Caza', marksCount: 12 })] }).fetch);
    const card = (await screen.findByRole('heading', { name: 'Caza' })).closest('section');
    expect(card).not.toBeNull();
    const inside = within(card as HTMLElement);
    expect(inside.getByText('Hoyt Alpha')).toBeInTheDocument();
    expect(inside.getByText('Ultraview · dual pin')).toBeInTheDocument();
    expect(inside.getByText('Hunter 400')).toBeInTheDocument();
    expect(inside.getByText(/Marcas: 12/)).toBeInTheDocument();
    expect(inside.getByText(/Editado/)).toBeInTheDocument();
  });

  it('names a setup without a name after its bow and its sight', async () => {
    renderApp('/', setupsServer({ setups: [setup()] }).fetch);
    expect(
      await screen.findByRole('heading', { name: 'Hoyt Alpha · Ultraview' }),
    ).toBeInTheDocument();
  });

  it('says when the bow of a setup was archived', async () => {
    const archived = setup({ bow: { ...bowRef, status: 'archived' } });
    renderApp('/', setupsServer({ setups: [archived] }).fetch);
    expect(await screen.findByText('(arco archivado)')).toBeInTheDocument();
  });

  it('shows the star at once and saves it with the version it saw', async () => {
    const api = setupsServer({ setups: [setup()] });
    renderApp('/', api.fetch);
    const star = await screen.findByRole('button', { name: 'Marcar como favorito' });
    await userEvent.click(star);

    expect(await screen.findByRole('button', { name: 'Quitar de favoritos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(api.sent.find((s) => s.method === 'PATCH')).toBeDefined());
    const patch = api.sent.find((s) => s.method === 'PATCH');
    expect(patch?.body).toEqual({ isFavorite: true });
    expect(patch?.headers.get('if-match')).toBe('"1"');
  });

  it('puts the star back and says so when the save fails', async () => {
    const api = setupsServer({
      setups: [setup()],
      routes: {
        [`PATCH /api/v1/setups/${SETUP_ID}`]: () =>
          errorEnvelope('SM-CORE-500-001', 'errors.core.unexpected', 500),
      },
    });
    renderApp('/', api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como favorito' }));
    expect(await screen.findByText('No pudimos guardar el favorito.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Marcar como favorito' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
  });

  it('shows an error with a way to retry', async () => {
    const api = setupsServer({
      routes: {
        'GET /api/v1/setups': () =>
          errorEnvelope('SM-CORE-404-001', 'errors.core.routeNotFound', 404),
      },
    });
    renderApp('/', api.fetch);
    expect(await screen.findByText('No pudimos cargar tus setups')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('The trash (HU-STP-04)', () => {
  const trashed = setup({
    deletedAt: '2026-11-01T12:00:00Z',
    purgeAt: '2026-12-01T12:00:00Z',
    marksCount: 12,
  });

  it('lists what was deleted with the day it goes for good, and restores it', async () => {
    const api = setupsServer({ trash: [trashed] });
    renderApp('/trash', api.fetch);
    expect(
      await screen.findByRole('heading', { name: 'Hoyt Alpha · Ultraview' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Se elimina el/)).toBeInTheDocument();
    expect(screen.getByText(/Marcas: 12/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/setups/${SETUP_ID}/restore`)).toBe(true),
    );
  });

  it('says the trash is empty', async () => {
    renderApp('/trash', setupsServer().fetch);
    expect(await screen.findByText('La papelera está vacía.')).toBeInTheDocument();
  });

  it('explains why a restore failed, e.g. after 30 days (SM-STP-410-001)', async () => {
    const api = setupsServer({
      trash: [trashed],
      routes: {
        [`POST /api/v1/setups/${SETUP_ID}/restore`]: () =>
          conflict('SM-STP-410-001', 'errors.setup.restoreExpired', {}, 410),
      },
    });
    renderApp('/trash', api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));
    expect(
      await screen.findByText('Pasaron más de 30 días: ya no se puede restaurar.'),
    ).toBeInTheDocument();
  });
});

describe('New setup (HU-STP-01)', () => {
  const open = async (api: ReturnType<typeof setupsServer>) => {
    renderApp('/setups/new', api.fetch);
    await screen.findByLabelText('Arco');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Hoyt Alpha' })).toBeInTheDocument(),
    );
  };
  const posted = (api: ReturnType<typeof setupsServer>) =>
    api.sent.find((s) => s.method === 'POST');

  it('joins a bow, a sight and several arrow sets, and opens the sight screen', async () => {
    const api = setupsServer();
    await open(api);
    await userEvent.type(screen.getByLabelText('Nombre (opcional)'), 'Torneo');
    await userEvent.selectOptions(screen.getByLabelText('Arco'), BOW_ID);
    await userEvent.selectOptions(screen.getByLabelText('Mira'), SIGHT_ID);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hunter 400' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pierce 400' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    // Saving opens the sight screen of the new setup (F1-08), named as the archer named it.
    expect(await screen.findByRole('heading', { name: 'Torneo', level: 1 })).toBeInTheDocument();
    expect(posted(api)?.body).toMatchObject({
      name: 'Torneo',
      bowId: BOW_ID,
      sightId: SIGHT_ID,
      arrowSetIds: [ARROW_ID, ARROW_2],
      isFavorite: false,
    });
    expect((posted(api)?.body as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
    expect(posted(api)?.headers.get('idempotency-key')).toBeTruthy();
  });

  it('asks for the three components before sending anything', async () => {
    const api = setupsServer();
    await open(api);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findAllByText('Completá este campo.')).toHaveLength(3);
    expect(api.sent).toEqual([]);
  });

  it('offers to add what is missing, with a link to the form that creates it', async () => {
    const api = setupsServer({ bows: [], sights: [], arrowSets: [] });
    renderApp('/setups/new', api.fetch);
    expect(await screen.findByRole('link', { name: '+ Cargar un arco nuevo' })).toHaveAttribute(
      'href',
      '/bows/new',
    );
    expect(screen.getByRole('link', { name: '+ Cargar una mira nueva' })).toHaveAttribute(
      'href',
      '/sights/new',
    );
    expect(screen.getByRole('link', { name: '+ Cargar un set de flechas nuevo' })).toHaveAttribute(
      'href',
      '/arrows/new',
    );
  });

  it('offers to add the arrows to the setup that already has the pair (SM-STP-409-001)', async () => {
    const api = setupsServer({
      routes: {
        'POST /api/v1/setups': () =>
          conflict('SM-STP-409-001', 'errors.setup.duplicateBowSight', {
            existingSetupId: SETUP_ID,
          }),
      },
    });
    await open(api);
    await userEvent.selectOptions(screen.getByLabelText('Arco'), BOW_ID);
    await userEvent.selectOptions(screen.getByLabelText('Mira'), SIGHT_ID);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pierce 400' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('Ya tenés un setup con ese arco y esa mira.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar estas flechas al setup existente' }),
    );
    await waitFor(() => expect(api.sent.find((s) => s.method === 'PATCH')).toBeDefined());
    expect(api.sent.find((s) => s.method === 'PATCH')?.body).toEqual({
      arrowSetIds: [ARROW_ID, ARROW_2],
    });
  });

  it('marks the select of a component that is no longer available (SM-STP-422-001)', async () => {
    const api = setupsServer({
      routes: {
        'POST /api/v1/setups': () =>
          conflict(
            'SM-STP-422-001',
            'errors.setup.componentUnavailable',
            { kind: 'sight', id: SIGHT_ID },
            422,
          ),
      },
    });
    await open(api);
    await userEvent.selectOptions(screen.getByLabelText('Arco'), BOW_ID);
    await userEvent.selectOptions(screen.getByLabelText('Mira'), SIGHT_ID);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hunter 400' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('El arco, la mira o el set de flechas no está disponible.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mira')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Edit setup', () => {
  it('shows the bow and the sight as fixed, and saves the name and the arrow sets', async () => {
    const api = setupsServer({ setups: [setup({ name: 'Caza' })] });
    renderApp(`/setups/${SETUP_ID}/edit`, api.fetch);
    expect(await screen.findByLabelText('Nombre (opcional)')).toBeInTheDocument();
    expect(
      screen.getByText('El arco y la mira no se cambian: otro par es otro setup.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Arco')).toBeNull();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Hunter 400' })).toBeChecked());

    await userEvent.click(screen.getByRole('checkbox', { name: 'Pierce 400' }));
    await userEvent.clear(screen.getByLabelText('Nombre (opcional)'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(api.sent.find((s) => s.method === 'PATCH')).toBeDefined());
    const patch = api.sent.find((s) => s.method === 'PATCH');
    expect(patch?.headers.get('if-match')).toBe('"1"');
    expect(patch?.body).toEqual({ name: null, arrowSetIds: [ARROW_ID, ARROW_2] });
  });

  it('explains why an arrow set cannot be taken away when it has marks (SM-STP-409-002)', async () => {
    const api = setupsServer({
      routes: {
        [`PATCH /api/v1/setups/${SETUP_ID}`]: () =>
          conflict('SM-STP-409-002', 'errors.setup.arrowSetHasMarks', {
            arrowSetId: ARROW_ID,
            marks: 4,
          }),
      },
    });
    renderApp(`/setups/${SETUP_ID}/edit`, api.fetch);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Hunter 400' })).toBeChecked());
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hunter 400' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pierce 400' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('Ese set de flechas tiene 4 marcas en este setup.'),
    ).toBeInTheDocument();
  });

  it('sends the setup to the trash after asking, and goes back to the Home', async () => {
    const api = setupsServer({ setups: [setup()] });
    renderApp(`/setups/${SETUP_ID}/edit`, api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Mandar a la papelera' }));
    const sheet = screen.getByRole('dialog', { name: '¿Mandar este setup a la papelera?' });
    expect(within(sheet).getByText(/30 días/)).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(api.sent.some((s) => s.method === 'DELETE')).toBe(true));
    expect(api.sent.find((s) => s.method === 'DELETE')?.headers.get('if-match')).toBe('"1"');
    expect(await screen.findByRole('heading', { name: 'Tus setups' })).toBeInTheDocument();
  });

  it('archives the setup from its own screen', async () => {
    const api = setupsServer({ setups: [setup()] });
    renderApp(`/setups/${SETUP_ID}/edit`, api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Archivar' }));
    await waitFor(() =>
      expect(api.sent.some((s) => s.path === `/api/v1/setups/${SETUP_ID}/archive`)).toBe(true),
    );
  });
});
