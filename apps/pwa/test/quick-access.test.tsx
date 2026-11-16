import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ANA, errorEnvelope, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

// HU-STP-03: "Always open here", and the app opening on it.

const BOW_ID = '01927e5a-0000-7000-8000-0000000000b1';
const SIGHT_ID = '01927e5a-0000-7000-8000-0000000000c1';
const ARROW_ID = '01927e5a-0000-7000-8000-0000000000d1';
const ARROW_2 = '01927e5a-0000-7000-8000-0000000000d2';
const SETUP_ID = '01927e5a-0000-7000-8000-0000000000e1';
const SETUP_2 = '01927e5a-0000-7000-8000-0000000000e2';
const STAMPS = {
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
};

const setup = (id: string, name: string) => ({
  id,
  ...STAMPS,
  name,
  bowId: BOW_ID,
  sightId: SIGHT_ID,
  arrowSetIds: [ARROW_ID, ARROW_2],
  isFavorite: false,
  status: 'active',
  bow: { id: BOW_ID, status: 'active', manufacturer: 'Hoyt', model: 'Alpha' },
  sight: {
    id: SIGHT_ID,
    status: 'active',
    model: 'Ultraview',
    pinType: 'dualpin',
    scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
  },
  arrowSets: [
    { id: ARROW_ID, status: 'active', name: 'Hunter 400' },
    { id: ARROW_2, status: 'active', name: 'Pierce 400' },
  ],
  marksCount: 0,
});

type Pair = { setupId: string; arrowSetId: string } | null;
type Sent = { body: unknown; ifMatch: string | null };
type Handler = (request: Request) => Response | Promise<Response>;

/** A server that remembers the quick access, as the real one does. */
function server(
  start: Pair = null,
  options: { me?: Handler; put?: Handler; signedOutFirst?: boolean } = {},
) {
  let quickAccess = start;
  let version = 1;
  let signedIn = options.signedOutFirst !== true;
  const sent: Sent[] = [];
  const profile = () => ({
    locale: 'es',
    unitSystem: 'metric',
    theme: 'system',
    quickAccess,
    deletionRequestedAt: null,
    version,
  });
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(signedIn ? ANA : null),
    'POST /api/auth/sign-in/username': () => {
      signedIn = true;
      return json({ token: 't', user: ANA.user });
    },
    'GET /api/v1/me': options.me ?? (() => json(profile())),
    'PUT /api/v1/me/quick-access':
      options.put ??
      (async (request) => {
        const body = (await request.json()) as Pair;
        sent.push({ body, ifMatch: request.headers.get('If-Match') });
        quickAccess = body;
        version += 1;
        return json(profile());
      }),
    'GET /api/v1/setups': () =>
      json({ items: [setup(SETUP_ID, 'Hunting'), setup(SETUP_2, 'Target')], nextCursor: null }),
    [`GET /api/v1/setups/${SETUP_ID}`]: () => json(setup(SETUP_ID, 'Hunting')),
    [`GET /api/v1/setups/${SETUP_2}`]: () => json(setup(SETUP_2, 'Target')),
    [`GET /api/v1/setups/${SETUP_ID}/marks`]: () => json({ items: [] }),
    [`GET /api/v1/setups/${SETUP_2}/marks`]: () => json({ items: [] }),
    'GET /api/v1/bows': () => json({ items: [], nextCursor: null }),
    'GET /api/v1/sights': () => json({ items: [], nextCursor: null }),
    'GET /api/v1/arrow-sets': () => json({ items: [], nextCursor: null }),
  });
  return { ...api, sent };
}

const HERE: Pair = { setupId: SETUP_ID, arrowSetId: ARROW_ID };

describe('The "Always open here" button (HU-STP-03)', () => {
  it('sets the quick access to this setup and arrow set, showing it at once', async () => {
    const user = userEvent.setup();
    const api = server();
    renderApp(`/setups/${SETUP_ID}`, api.fetch);
    const button = await screen.findByRole('button', { name: 'Abrir siempre acá' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(button).toBeEnabled());

    await user.click(button);

    const on = await screen.findByRole('button', { name: /Se abre siempre acá/ });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    expect(api.sent).toEqual([{ body: HERE, ifMatch: '"1"' }]);
    expect(screen.getByText(/Tocá de nuevo/)).toBeInTheDocument();
  });

  it('clears it when pressed again: null, with the version the first one made', async () => {
    const user = userEvent.setup();
    const api = server(HERE);
    renderApp(`/setups/${SETUP_ID}`, api.fetch);
    const on = await screen.findByRole('button', { name: /Se abre siempre acá/ });
    expect(on).toHaveAttribute('aria-pressed', 'true');

    await user.click(on);

    expect(await screen.findByRole('button', { name: 'Abrir siempre acá' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(api.sent).toEqual([{ body: null, ifMatch: '"1"' }]);
  });

  it('is off on another arrow set of the same setup, and on another setup: there is one per archer', async () => {
    const user = userEvent.setup();
    const api = server(HERE);
    renderApp(`/setups/${SETUP_ID}?arrowSet=${ARROW_2}`, api.fetch);
    const button = await screen.findByRole('button', { name: 'Abrir siempre acá' });
    await user.click(button);
    expect(await screen.findByRole('button', { name: /Se abre siempre acá/ })).toBeVisible();
    expect(api.sent).toEqual([
      { body: { setupId: SETUP_ID, arrowSetId: ARROW_2 }, ifMatch: '"1"' },
    ]);
  });

  it('puts it back and says so when the server refuses', async () => {
    const user = userEvent.setup();
    const api = server(null, {
      put: () => errorEnvelope('SM-ACC-422-001', 'errors.account.invalidQuickAccess', 422),
    });
    renderApp(`/setups/${SETUP_ID}`, api.fetch);
    await user.click(await screen.findByRole('button', { name: 'Abrir siempre acá' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pertenece al setup/);
    expect(screen.getByRole('button', { name: 'Abrir siempre acá' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('Opening the app on the quick access (HU-STP-03)', () => {
  it('lands straight on the sight screen with that arrow set, instead of the Home', async () => {
    const api = server({ setupId: SETUP_2, arrowSetId: ARROW_2 });
    const { app } = renderApp('/', api.fetch);
    expect(await screen.findByRole('heading', { name: 'Target', level: 1 })).toBeVisible();
    expect(app.router.state.location.pathname).toBe(`/setups/${SETUP_2}`);
    expect(app.router.state.location.search).toMatchObject({ arrowSet: ARROW_2 });
    expect(screen.getByLabelText('Set de flechas')).toHaveValue(ARROW_2);
  });

  it('opens on the Home when there is none', async () => {
    const { app } = renderApp('/', server().fetch);
    expect(await screen.findByRole('heading', { name: 'Tus setups' })).toBeVisible();
    expect(app.router.state.location.pathname).toBe('/');
  });

  it('is only for opening the app: going back to the Home later stays on the Home', async () => {
    const user = userEvent.setup();
    const { app } = renderApp('/', server(HERE).fetch);
    await screen.findByRole('heading', { name: 'Hunting', level: 1 });
    await user.click(screen.getByRole('link', { name: /Tus setups/ }));
    expect(await screen.findByRole('heading', { name: 'Tus setups', level: 1 })).toBeVisible();
    expect(app.router.state.location.pathname).toBe('/');
  });

  it('leaves a link to another screen alone, and the Home after it too', async () => {
    const { app } = renderApp('/bows', server(HERE).fetch);
    await screen.findByRole('heading', { name: 'Arcos', level: 1 });
    await app.router.navigate({ to: '/' });
    expect(await screen.findByRole('heading', { name: 'Tus setups', level: 1 })).toBeVisible();
    expect(app.router.state.location.pathname).toBe('/');
  });

  it('applies after signing in: opening the app signed out and then entering', async () => {
    const user = userEvent.setup();
    const api = server(HERE, { signedOutFirst: true });
    const { app } = renderApp('/', api.fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await user.type(screen.getByLabelText('Email o usuario'), 'ana');
    await user.type(screen.getByLabelText('Contraseña'), 'whatever it is');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Hunting', level: 1 })).toBeVisible();
    expect(app.router.state.location.pathname).toBe(`/setups/${SETUP_ID}`);
  });

  it('does not wait on a profile that cannot be read: the Home opens', async () => {
    const api = server(HERE, {
      me: () => errorEnvelope('SM-NET-500-001', 'errors.net.badResponse', 500),
    });
    const { app } = renderApp('/', api.fetch);
    expect(await screen.findByRole('heading', { name: 'Tus setups', level: 1 })).toBeVisible();
    expect(app.router.state.location.pathname).toBe('/');
  });

  it('opens the first arrow set when the one it remembers is no longer in the setup', async () => {
    const gone = '01927e5a-0000-7000-8000-0000000000d9';
    const api = server({ setupId: SETUP_ID, arrowSetId: gone });
    renderApp('/', api.fetch);
    await screen.findByRole('heading', { name: 'Hunting', level: 1 });
    expect(screen.getByLabelText('Set de flechas')).toHaveValue(ARROW_ID);
  });
});
