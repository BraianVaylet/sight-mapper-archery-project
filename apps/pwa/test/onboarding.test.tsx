import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ANA, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

// F1-17: the guide on the empty Home (FUNCIONAL §2.1), and the way back from each form.

const STAMPS = {
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
};
const bowRow = (id: string, model: string) => ({
  id,
  ...STAMPS,
  bowType: 'compound',
  manufacturer: 'Hoyt',
  model,
  status: 'active',
});
const sightRow = (id: string) => ({
  id,
  ...STAMPS,
  model: 'Ultraview',
  pinType: 'dualpin',
  scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
  status: 'active',
});
const arrowRow = (id: string) => ({ id, ...STAMPS, name: 'Hunter 400', status: 'active' });

type Posted = { path: string; body: { id: string } & Record<string, unknown> };

/** A server that keeps what it is given, so a form that saves and comes back finds it in the list. */
function server(
  start: { bows?: unknown[]; sights?: unknown[]; arrowSets?: unknown[]; setups?: unknown[] } = {},
) {
  const bows = [...(start.bows ?? [])];
  const sights = [...(start.sights ?? [])];
  const arrowSets = [...(start.arrowSets ?? [])];
  const setups = [...(start.setups ?? [])];
  const posted: Posted[] = [];
  const page = (items: unknown[]) => () => json({ items, nextCursor: null });
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () =>
      json({
        locale: 'es',
        unitSystem: 'metric',
        theme: 'system',
        quickAccess: null,
        deletionRequestedAt: null,
        version: 1,
      }),
    'GET /api/v1/bows': () => page(bows)(),
    'GET /api/v1/sights': () => page(sights)(),
    'GET /api/v1/arrow-sets': () => page(arrowSets)(),
    'GET /api/v1/setups': () => page(setups)(),
    'POST /api/v1/bows': async (request) => {
      const body = (await request.json()) as Posted['body'];
      posted.push({ path: '/bows', body });
      bows.push(bowRow(body.id, String(body['model'] ?? 'New')));
      return json(bowRow(body.id, String(body['model'] ?? 'New')), 201);
    },
    'POST /api/v1/arrow-sets': async (request) => {
      const body = (await request.json()) as Posted['body'];
      posted.push({ path: '/arrow-sets', body });
      arrowSets.push(arrowRow(body.id));
      return json(arrowRow(body.id), 201);
    },
  });
  return { ...api, posted };
}

const B1 = '01927e5a-0000-7000-8000-0000000000b1';
const C1 = '01927e5a-0000-7000-8000-0000000000c1';
const D1 = '01927e5a-0000-7000-8000-0000000000d1';

const stepOf = async (key: string) => {
  const list = await screen.findByRole('list', { name: 'Pasos para armar tu primer setup' });
  const item = list.querySelector(`[data-step="${key}"]`);
  if (item === null) throw new Error(`no step ${key}`);
  return item as HTMLElement;
};

describe('The guide on the empty Home (FUNCIONAL §2.1)', () => {
  it('is "Your first setup in 4 steps", and starts with the bow', async () => {
    renderApp('/', server().fetch);
    expect(
      await screen.findByRole('heading', { name: 'Tu primer setup en 4 pasos' }),
    ).toBeVisible();
    expect(screen.getByText('Todavía no tenés setups')).toBeVisible();

    const bow = within(await stepOf('bow'));
    expect(bow.getByText('Cargá tu arco')).toBeVisible();
    expect((await stepOf('bow')).dataset['state']).toBe('current');
    // Each step opens its form, and the form comes back here on saving.
    expect(bow.getByRole('link', { name: 'Cargar arco' })).toHaveAttribute(
      'href',
      '/bows/new?next=home',
    );
    expect((await stepOf('sight')).dataset['state']).toBe('later');
    expect((await stepOf('arrows')).dataset['state']).toBe('later');
    // It is a guide, not a wizard: what is not yet its turn is not a button.
    expect(within(await stepOf('sight')).queryByRole('link')).toBeNull();
    expect(within(await stepOf('setup')).queryByRole('link')).toBeNull();
    expect(screen.getByText('Primero los tres pasos de arriba.')).toBeVisible();
  });

  it('crosses off what is loaded, with its name, and moves on to the next step', async () => {
    renderApp('/', server({ bows: [bowRow(B1, 'Alpha')] }).fetch);
    await waitFor(async () => expect((await stepOf('bow')).dataset['state']).toBe('done'));
    const bow = within(await stepOf('bow'));
    expect(bow.getByText('Hoyt Alpha')).toBeVisible();
    expect(bow.getByText('Listo')).toBeVisible();
    expect((await stepOf('sight')).dataset['state']).toBe('current');
    expect(within(await stepOf('sight')).getByRole('link')).toHaveAttribute(
      'href',
      '/sights/new?next=home',
    );
  });

  it('skips the steps an archer with equipment has done: they start at the setup', async () => {
    renderApp(
      '/',
      server({
        bows: [bowRow(B1, 'Alpha')],
        sights: [sightRow(C1)],
        arrowSets: [arrowRow(D1)],
      }).fetch,
    );
    await waitFor(async () => expect((await stepOf('arrows')).dataset['state']).toBe('done'));
    const setup = within(await stepOf('setup'));
    expect((await stepOf('setup')).dataset['state']).toBe('current');
    expect(
      setup.getByText('Lo que cargaste ya viene elegido: solo tenés que guardar.'),
    ).toBeVisible();
    expect(setup.getByRole('link', { name: 'Crear setup' })).toHaveAttribute('href', '/setups/new');
  });

  it('is gone once there is a setup: the Home shows the setups', async () => {
    const setup = {
      id: '01927e5a-0000-7000-8000-0000000000e1',
      ...STAMPS,
      bowId: B1,
      sightId: C1,
      arrowSetIds: [D1],
      isFavorite: false,
      status: 'active',
      bow: { id: B1, status: 'active', manufacturer: 'Hoyt', model: 'Alpha' },
      sight: {
        id: C1,
        status: 'active',
        model: 'Ultraview',
        pinType: 'dualpin',
        scale: sightRow(C1).scale,
      },
      arrowSets: [{ id: D1, status: 'active', name: 'Hunter 400' }],
      marksCount: 0,
    };
    renderApp('/', server({ setups: [setup] }).fetch);
    expect(await screen.findByRole('heading', { name: 'Hoyt Alpha · Ultraview' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Tu primer setup en 4 pasos' })).toBeNull();
  });
});

describe('The way back from each form', () => {
  it('a new bow with ?next=home comes back to the guide, with the bow crossed off', async () => {
    const user = userEvent.setup();
    const api = server();
    const { app } = renderApp('/bows/new?next=home', api.fetch);
    await user.type(await screen.findByLabelText('Modelo'), 'Alpha');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByRole('heading', { name: 'Tu primer setup en 4 pasos' }),
    ).toBeVisible();
    expect(app.router.state.location.pathname).toBe('/');
    await waitFor(async () => expect((await stepOf('bow')).dataset['state']).toBe('done'));
    expect(api.posted).toHaveLength(1);
  });

  it('a new arrow set with ?next=setup goes on to the setup with it chosen', async () => {
    const user = userEvent.setup();
    const api = server({ bows: [bowRow(B1, 'Alpha')], sights: [sightRow(C1)] });
    const { app } = renderApp('/arrows/new?next=setup', api.fetch);
    await user.type(await screen.findByLabelText('Nombre corto'), 'Hunter 400');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(app.router.state.location.pathname).toBe('/setups/new'));
    const created = api.posted[0]?.body.id;
    expect(app.router.state.location.search).toEqual({ arrowSet: created });
    // The bow, the sight and the arrows are all there is, so the form is ready to save.
    await waitFor(() => expect(screen.getByLabelText('Arco')).toHaveValue(B1));
    expect(screen.getByRole('checkbox', { name: 'Hunter 400' })).toBeChecked();
  });

  it('without ?next= it goes to its own list, as before', async () => {
    const user = userEvent.setup();
    const { app } = renderApp('/bows/new', server().fetch);
    await user.type(await screen.findByLabelText('Modelo'), 'Alpha');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(app.router.state.location.pathname).toBe('/bows'));
  });

  it('ignores a ?next= it does not know: nobody is sent anywhere else by the URL', async () => {
    const user = userEvent.setup();
    const { app } = renderApp('/bows/new?next=https://evil.test', server().fetch);
    await user.type(await screen.findByLabelText('Modelo'), 'Alpha');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(app.router.state.location.pathname).toBe('/bows'));
  });

  it('editing a bow goes back to the list even with ?next= on the URL', async () => {
    const api = fakeApi({
      'GET /api/auth/get-session': () => json(ANA),
      'GET /api/v1/me': () =>
        json({
          locale: 'es',
          unitSystem: 'metric',
          theme: 'system',
          quickAccess: null,
          deletionRequestedAt: null,
          version: 1,
        }),
      [`GET /api/v1/bows/${B1}`]: () => json(bowRow(B1, 'Alpha')),
      'GET /api/v1/bows': () => json({ items: [bowRow(B1, 'Alpha')], nextCursor: null }),
      [`PATCH /api/v1/bows/${B1}`]: () => json({ ...bowRow(B1, 'Alpha'), version: 2 }),
    });
    const user = userEvent.setup();
    const { app } = renderApp(`/bows/${B1}`, api.fetch);
    await user.click(await screen.findByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(app.router.state.location.pathname).toBe('/bows'));
  });
});
