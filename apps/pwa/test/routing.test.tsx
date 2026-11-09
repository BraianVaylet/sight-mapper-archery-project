import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { usePreferences } from '../src/app/preferences.js';
import { ANA, errorEnvelope, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

const signedIn = () => fakeApi({ 'GET /api/auth/get-session': () => json(ANA) });
const signedOut = () => fakeApi({ 'GET /api/auth/get-session': () => json(null) });

describe('the guard of private screens', () => {
  it('sends someone without a session to sign-in, remembering where they were going', async () => {
    const api = signedOut();
    const { app } = renderApp('/trash', api.fetch);

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(app.router.state.location.pathname).toBe('/sign-in');
    expect(app.router.state.location.search).toEqual({ redirect: '/trash' });
  });

  it('lets a signed-in archer reach the private screens', async () => {
    const api = signedIn();
    renderApp('/trash', api.fetch);
    expect(await screen.findByRole('heading', { name: 'Papelera' })).toBeInTheDocument();
  });

  it('asks the server once for several screens, not on every navigation', async () => {
    const api = signedIn();
    const { app } = renderApp('/', api.fetch);
    await screen.findByRole('heading', { name: 'Tus setups' });
    await app.router.navigate({ to: '/trash' });
    await screen.findByRole('heading', { name: 'Papelera' });
    expect(api.calls.filter((c) => c.endsWith('get-session'))).toHaveLength(1);
  });

  it('keeps a signed-in archer away from sign-in and sign-up', async () => {
    const api = signedIn();
    const { app } = renderApp('/sign-in', api.fetch);
    expect(await screen.findByRole('heading', { name: 'Tus setups' })).toBeInTheDocument();
    expect(app.router.state.location.pathname).toBe('/');
  });

  it('returns a signed-in archer to a safe redirect, and ignores one that leaves the app', async () => {
    const safe = renderApp('/sign-in?redirect=/trash', signedIn().fetch);
    expect(await screen.findByRole('heading', { name: 'Papelera' })).toBeInTheDocument();
    safe.unmount();

    const unsafe = renderApp('/sign-in?redirect=//evil.test', signedIn().fetch);
    expect(await screen.findByRole('heading', { name: 'Tus setups' })).toBeInTheDocument();
    expect(unsafe.app.router.state.location.pathname).toBe('/');
  });

  it('keeps reset and verify reachable whatever the session', async () => {
    renderApp('/verify-email?error=INVALID_TOKEN', signedIn().fetch);
    expect(await screen.findByRole('heading', { name: 'Verificar email' })).toBeInTheDocument();
    renderApp('/reset-password?token=abc', signedIn().fetch);
    expect(await screen.findByRole('heading', { name: 'Nueva contraseña' })).toBeInTheDocument();
  });
});

describe('failures', () => {
  it('shows a translated error with a retry and the request id, never a blank screen', async () => {
    const api = fakeApi({
      'GET /api/auth/get-session': () =>
        errorEnvelope('SM-CORE-404-001', 'errors.core.routeNotFound', 404, 'req-77'),
    });
    renderApp('/', api.fetch);

    expect(await screen.findByText('Esta pantalla falló')).toBeInTheDocument();
    expect(screen.getByText('No encontramos lo que buscás.')).toBeInTheDocument();
    expect(screen.getByText('req-77')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toBeInTheDocument();
  });

  it('retries from the error screen', async () => {
    let attempts = 0;
    const api = fakeApi({
      'GET /api/auth/get-session': () => {
        attempts += 1;
        return attempts === 1
          ? errorEnvelope('SM-CORE-404-001', 'errors.core.routeNotFound', 404)
          : json(ANA);
      },
    });
    renderApp('/', api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Tus setups' })).toBeInTheDocument();
  });

  it('answers an unknown address with a not-found screen and a way home', async () => {
    renderApp('/nope', signedOut().fetch);
    expect(await screen.findByText('No encontramos esa página')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toBeInTheDocument();
  });
});

describe('the frame', () => {
  it('has a skip link, one main landmark and the version', async () => {
    renderApp('/verify-email', signedOut().fetch);
    await screen.findByRole('heading', { name: 'Verificar email' });
    expect(screen.getByRole('link', { name: 'Ir al contenido' })).toHaveAttribute('href', '#main');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByText('Versión dev')).toBeInTheDocument();
  });

  it('switches language and theme from the footer, on any screen', async () => {
    renderApp('/verify-email', signedOut().fetch);
    await screen.findByRole('heading', { name: 'Verificar email' });

    await userEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('heading', { name: 'Verify email' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
    expect(usePreferences.getState().theme).toBe('dark');
  });
});
