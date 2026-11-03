import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { usePreferences } from '../src/app/preferences.js';
import { ANA, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

const STAMPS = {
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
};
const bow = (n: number) => ({
  id: `01927e5a-0000-7000-8000-00000000b00${n}`,
  ...STAMPS,
  bowType: 'compound',
  model: `Bow ${n}`,
  status: 'active',
});
const sight = (n: number) => ({
  id: `01927e5a-0000-7000-8000-00000000c00${n}`,
  ...STAMPS,
  model: `Sight ${n}`,
  pinType: 'monopin',
  scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
  status: 'active',
});
const arrows = (n: number) => ({
  id: `01927e5a-0000-7000-8000-00000000d00${n}`,
  ...STAMPS,
  name: `Arrows ${n}`,
  status: 'active',
});

function menuServer(locale: 'es' | 'en' = 'es') {
  let signedIn = true;
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(signedIn ? ANA : null),
    'POST /api/auth/sign-out': () => {
      signedIn = false;
      return json({ success: true });
    },
    'GET /api/v1/me': () =>
      json({
        locale,
        unitSystem: 'metric',
        theme: 'system',
        quickAccess: null,
        deletionRequestedAt: null,
        version: 1,
      }),
    'GET /api/v1/bows': () => json({ items: [bow(1), bow(2)], nextCursor: null }),
    'GET /api/v1/sights': () => json({ items: [sight(1)], nextCursor: null }),
    'GET /api/v1/arrow-sets': () =>
      json({ items: [arrows(1), arrows(2), arrows(3)], nextCursor: null }),
    'GET /api/v1/setups': () => json({ items: [], nextCursor: null }),
  });
  return api;
}

const open = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Abrir el menú' }));
  return screen.getByRole('dialog', { name: 'Menú' });
};

describe('The side menu (F1-06)', () => {
  it('is closed until the archer opens it, from a button that is always in the header', async () => {
    renderApp('/', menuServer().fetch);
    const button = await screen.findByRole('button', { name: 'Abrir el menú' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Menú' })).toBeInTheDocument();
  });

  it('shows how many bows, sights and arrow sets the archer has', async () => {
    renderApp('/', menuServer().fetch);
    const menu = await open();
    await waitFor(() =>
      expect(within(menu).getByRole('button', { name: /^Arcos\s*2$/ })).toBeInTheDocument(),
    );
    expect(within(menu).getByRole('button', { name: /^Miras\s*1$/ })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /^Flechas\s*3$/ })).toBeInTheDocument();
  });

  it('lists Statistics as coming soon: it is announced as disabled and goes nowhere', async () => {
    const { app } = renderApp('/', menuServer().fetch);
    const menu = await open();
    const stats = within(menu).getByRole('button', { name: /Estadísticas/ });
    expect(stats).toHaveAttribute('aria-disabled', 'true');
    expect(within(stats).getByText('Próximamente')).toBeInTheDocument();
    await userEvent.click(stats);
    expect(app.router.state.location.pathname).toBe('/');
    expect(screen.getByRole('dialog', { name: 'Menú' })).toBeInTheDocument();
  });

  it('closes with Escape and keeps the focus inside while it is open', async () => {
    renderApp('/', menuServer().fetch);
    const menu = await open();
    await userEvent.tab();
    expect(menu).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('goes where it says and closes, marking the current screen', async () => {
    const { app } = renderApp('/', menuServer().fetch);
    const menu = await open();
    await userEvent.click(within(menu).getByRole('button', { name: /^Papelera/ }));
    await waitFor(() => expect(app.router.state.location.pathname).toBe('/trash'));
    expect(screen.queryByRole('dialog')).toBeNull();

    const again = await open();
    expect(within(again).getByRole('button', { name: /^Papelera/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('reaches the account and the appearance screens', async () => {
    const { app } = renderApp('/', menuServer().fetch);
    await userEvent.click(within(await open()).getByRole('button', { name: 'Apariencia' }));
    await waitFor(() => expect(app.router.state.location.pathname).toBe('/settings/appearance'));
    await userEvent.click(within(await open()).getByRole('button', { name: 'Cuenta' }));
    await waitFor(() => expect(app.router.state.location.pathname).toBe('/profile'));
  });

  it('logs out: ends the session, forgets the data and goes to sign-in', async () => {
    const api = menuServer();
    const { app } = renderApp('/', api.fetch);
    const menu = await open();
    await userEvent.click(within(menu).getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(api.calls).toContain('POST /api/auth/sign-out');
    expect(app.queryClient.getQueryCache().getAll()).toHaveLength(0);
    // The private screens are shut again.
    await app.router.navigate({ to: '/bows' });
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('says so, and stays signed in, when logging out fails', async () => {
    const api = fakeApi({
      'GET /api/auth/get-session': () => json(ANA),
      'POST /api/auth/sign-out': () =>
        json(
          {
            success: false,
            error: {
              code: 'SM-CORE-500-001',
              messageKey: 'errors.core.unexpected',
              params: {},
              requestId: 'r',
              timestamp: 't',
            },
          },
          500,
        ),
      'GET /api/v1/me': () =>
        json({
          locale: 'es',
          unitSystem: 'metric',
          theme: 'system',
          quickAccess: null,
          deletionRequestedAt: null,
          version: 1,
        }),
      'GET /api/v1/bows': () => json({ items: [], nextCursor: null }),
      'GET /api/v1/sights': () => json({ items: [], nextCursor: null }),
      'GET /api/v1/arrow-sets': () => json({ items: [], nextCursor: null }),
      'GET /api/v1/setups': () => json({ items: [], nextCursor: null }),
    });
    renderApp('/', api.fetch);
    await userEvent.click(within(await open()).getByRole('button', { name: 'Cerrar sesión' }));
    expect(
      await screen.findByText('No pudimos cerrar la sesión. Probá de nuevo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Menú' })).toBeInTheDocument();
  });

  it('speaks English when the archer chose it', async () => {
    usePreferences.setState({ locale: 'en' });
    // The profile wins over the device, so the archer's saved language is English too.
    renderApp('/', menuServer('en').fetch);
    const menu = await (async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Open the menu' }));
      return screen.getByRole('dialog', { name: 'Menu' });
    })();
    expect(within(menu).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(within(menu).getByText('Coming soon')).toBeInTheDocument();
  });
});
