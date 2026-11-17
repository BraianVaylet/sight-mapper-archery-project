import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { usePreferences } from '../src/app/preferences.js';
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

/** A server that keeps one profile and answers like the real one: ETag-free, version in the body. */
function profileServer(
  overrides: Record<string, (request: Request) => Response | Promise<Response>> = {},
) {
  let current = { ...PROFILE };
  const patches: { body: Record<string, unknown>; ifMatch: string | null }[] = [];
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () => json(current),
    'PATCH /api/v1/me/preferences': async (request) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push({ body, ifMatch: request.headers.get('if-match') });
      current = { ...current, ...body, version: current.version + 1 };
      return json(current);
    },
    ...overrides,
  });
  return { ...api, patches };
}

/** The controls of the screen itself: the footer has its own copy of theme and language. */
const radio = (name: string) => within(screen.getByRole('main')).getByRole('radio', { name });

describe('Settings (HU-ACC-04, RF-ACC-04)', () => {
  it('shows the archer’s saved preferences, whatever the device remembered', async () => {
    const api = profileServer({
      'GET /api/v1/me': () =>
        json({ ...PROFILE, theme: 'dark', unitSystem: 'imperial', locale: 'en' }),
    });
    renderApp('/settings', api.fetch);

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
    expect(radio('Dark')).toBeChecked();
    expect(radio('Imperial (yards)')).toBeChecked();
    expect(document.documentElement.lang).toBe('en');
  });

  it('changes the theme at once and saves it with the version it saw', async () => {
    const api = profileServer();
    renderApp('/settings', api.fetch);
    await screen.findByRole('radio', { name: 'Métrico (metros)' });

    await userEvent.click(radio('Oscuro'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0]).toEqual({ body: { theme: 'dark' }, ifMatch: '"1"' });
  });

  it('switches the language without reloading, in every label', async () => {
    const api = profileServer();
    renderApp('/settings', api.fetch);
    await screen.findByRole('radio', { name: 'Métrico (metros)' });

    await userEvent.click(radio('English'));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(radio('Metric (meters)')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    await waitFor(() => expect(api.patches[0]?.body).toEqual({ locale: 'en' }));
  });

  it('changes the units and saves them, leaving the rest alone', async () => {
    const api = profileServer();
    renderApp('/settings', api.fetch);
    await screen.findByRole('radio', { name: 'Métrico (metros)' });

    await userEvent.click(radio('Imperial (yardas)'));
    expect(radio('Imperial (yardas)')).toBeChecked();
    await waitFor(() => expect(api.patches[0]?.body).toEqual({ unitSystem: 'imperial' }));
  });

  it('sends two quick changes one after the other, each with the version the last one made', async () => {
    const api = profileServer();
    renderApp('/settings', api.fetch);
    await screen.findByRole('radio', { name: 'Métrico (metros)' });

    await userEvent.click(radio('Oscuro'));
    await userEvent.click(radio('Imperial (yardas)'));
    await waitFor(() => expect(api.patches).toHaveLength(2));
    expect(api.patches.map((p) => p.ifMatch)).toEqual(['"1"', '"2"']);
  });

  it('puts the old value back and says why when the save fails', async () => {
    const api = profileServer({
      'PATCH /api/v1/me/preferences': () =>
        errorEnvelope('SM-CORE-500-001', 'errors.core.unexpected', 500),
    });
    renderApp('/settings', api.fetch);
    await screen.findByRole('radio', { name: 'Métrico (metros)' });

    await userEvent.click(radio('Imperial (yardas)'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal de nuestro lado.');
    await waitFor(() => expect(radio('Métrico (metros)')).toBeChecked());
  });

  it('groups the settings, says what each one changes, and closes with the version', async () => {
    renderApp('/settings', profileServer().fetch);
    await screen.findByRole('radio', { name: 'Métrico (metros)' });

    expect(screen.getByRole('region', { name: 'Pantalla' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Idioma y unidades' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Unidades' })).toHaveAccessibleDescription(
      /tus marcas no se tocan/,
    );
    const about = within(screen.getByRole('region', { name: 'Acerca de' }));
    expect(about.getByText('Versión de la app')).toBeInTheDocument();
    expect(about.getByText('dev')).toBeInTheDocument();
  });

  it('is the only place with theme and language: one switch of each, here', async () => {
    renderApp('/settings', profileServer().fetch);
    await screen.findByRole('radio', { name: 'Métrico (metros)' });
    expect(screen.getAllByRole('radio', { name: 'Español' })).toHaveLength(1);
    expect(screen.getAllByRole('radio', { name: 'Oscuro' })).toHaveLength(1);
    expect(usePreferences.getState().locale).toBe('es');
  });

  it('takes the old address of the settings to the new one', async () => {
    const { app } = renderApp('/settings/appearance', profileServer().fetch);
    expect(await screen.findByRole('heading', { name: 'Ajustes', level: 1 })).toBeInTheDocument();
    expect(app.router.state.location.pathname).toBe('/settings');
  });
});
