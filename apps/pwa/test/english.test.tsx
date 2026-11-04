import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { usePreferences } from '../src/app/preferences.js';
import { ANA, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

// F1-13: the whole product in English, screen by screen. A string that is still Spanish, or a
// placeholder that was never filled, shows up here before an archer sees it.

const BOW_ID = '01927e5a-0000-7000-8000-0000000000b1';
const SIGHT_ID = '01927e5a-0000-7000-8000-0000000000c1';
const ARROW_ID = '01927e5a-0000-7000-8000-0000000000d1';
const SETUP_ID = '01927e5a-0000-7000-8000-0000000000e1';
const STAMPS = {
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
};

const bow = {
  id: BOW_ID,
  ...STAMPS,
  bowType: 'compound',
  manufacturer: 'Hoyt',
  model: 'Alpha',
  status: 'active',
};
const sight = {
  id: SIGHT_ID,
  ...STAMPS,
  model: 'Ultraview',
  pinType: 'dualpin',
  scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
  status: 'active',
};
const arrows = { id: ARROW_ID, ...STAMPS, name: 'Hunter 400', status: 'active' };
const setup = {
  id: SETUP_ID,
  ...STAMPS,
  name: 'Hunting',
  bowId: BOW_ID,
  sightId: SIGHT_ID,
  arrowSetIds: [ARROW_ID],
  isFavorite: false,
  status: 'active',
  bow: { id: BOW_ID, status: 'active', manufacturer: 'Hoyt', model: 'Alpha' },
  sight: {
    id: SIGHT_ID,
    status: 'active',
    model: 'Ultraview',
    pinType: 'dualpin',
    scale: sight.scale,
  },
  arrowSets: [{ id: ARROW_ID, status: 'active', name: 'Hunter 400' }],
  marksCount: 5,
};
const mark = (distanceM: number, reading: number) => ({
  id: `01927e5a-0000-7000-8000-000000000${String(distanceM).padStart(3, '0')}`,
  ...STAMPS,
  setupId: SETUP_ID,
  arrowSetId: ARROW_ID,
  distanceM,
  scaleValueMm: reading * 10,
  origin: 'measured',
  measuredAt: '2026-11-02T12:00:00Z',
});
// 40 m is 0.8 off, so the Doctor has something to say.
const MARKS = [mark(20, 0.3), mark(30, 0.8), mark(40, 2.4), mark(50, 2.6), mark(60, 3.6)];

const PROFILE = {
  locale: 'en',
  unitSystem: 'metric',
  theme: 'system',
  quickAccess: null,
  deletionRequestedAt: null,
  version: 1,
};

const page = (items: unknown[]) => () => json({ items, nextCursor: null });

function server(signedIn = true) {
  return fakeApi({
    'GET /api/auth/get-session': () => json(signedIn ? ANA : null),
    'GET /api/v1/me': () => json(PROFILE),
    'GET /api/v1/bows': page([bow]),
    'GET /api/v1/bows/*': () => json(bow),
    'GET /api/v1/sights': page([sight]),
    'GET /api/v1/sights/*': () => json(sight),
    'GET /api/v1/arrow-sets': page([arrows]),
    'GET /api/v1/arrow-sets/*': () => json(arrows),
    'GET /api/v1/setups': page([setup]),
    'GET /api/v1/setups/trash': () =>
      json({
        items: [{ ...setup, deletedAt: '2026-11-01T12:00:00Z', purgeAt: '2026-12-01T12:00:00Z' }],
      }),
    'GET /api/v1/setups/*': () => json(setup),
    'GET /api/v1/setups/*/marks': () => json({ items: MARKS }),
  });
}

/** Words and signs that only Spanish uses, in the places an English screen could leak them. */
const SPANISH =
  /[¿¡áéíóúñ]|\b(Guardar|Cancelar|Borrar|Editar|Todavía|Nuevo|Nueva|Tus|Elegí|Volvé|Lectura|Distancia|Marcas?|Arcos?|Mira|Flechas|Papelera|Restaurar|Iniciar|Contraseña|Cuenta|Idioma|Tema|Versión|Herramientas|Próximamente|Reemplazar|Deshacer|Cerrar|Volver|Cargando|Usuario|Correo|Entrar|Salir)\b/;
const PLACEHOLDER = /\{\{|\}\}/;

/** Waits for the screen to settle, then checks every word the archer can read. */
async function settle(path: string, api = server()) {
  renderApp(path, api.fetch);
  await waitFor(() => expect(document.querySelector('h1')).not.toBeNull());
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
}
const readable = () => {
  const alt = [...document.querySelectorAll('[aria-label],[title],[placeholder]')].flatMap((el) => [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('placeholder'),
  ]);
  const all = `${document.body.textContent ?? ''} ${alt.filter(Boolean).join(' ')}`;
  // The language switcher names each language in itself: "Español" is right on an English screen.
  return all.replace(/Español/g, '');
};
const inEnglish = () => {
  const text = readable();
  expect(text.match(SPANISH)?.[0], `Spanish found: ${text.slice(0, 200)}`).toBeUndefined();
  expect(text).not.toMatch(PLACEHOLDER);
  expect(document.documentElement.lang).toBe('en');
};

const PRIVATE: [string, string][] = [
  ['Home', '/'],
  ['Bows', '/bows'],
  ['New bow', '/bows/new'],
  ['Edit bow', `/bows/${BOW_ID}`],
  ['Sights', '/sights'],
  ['New sight', '/sights/new'],
  ['Edit sight', `/sights/${SIGHT_ID}`],
  ['Arrow sets', '/arrows'],
  ['New arrow set', '/arrows/new'],
  ['Edit arrow set', `/arrows/${ARROW_ID}`],
  ['New setup', '/setups/new'],
  ['Edit setup', `/setups/${SETUP_ID}/edit`],
  ['Sight screen', `/setups/${SETUP_ID}`],
  ['Distances', `/setups/${SETUP_ID}/distances`],
  ['Mark Doctor', `/setups/${SETUP_ID}/doctor`],
  ['Print', `/setups/${SETUP_ID}/print`],
  ['Trash', '/trash'],
  ['Profile', '/profile'],
  ['Appearance', '/settings/appearance'],
];

describe('Every private screen reads in English (F1-13)', () => {
  it.each(PRIVATE)('%s', async (_name, path) => {
    await settle(path);
    inEnglish();
  });

  it('the mark sheet, with its validation errors, and the Doctor message', async () => {
    const user = userEvent.setup();
    await settle(`/setups/${SETUP_ID}`);
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '+ Add sight mark' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    inEnglish();
    await user.type(screen.getByLabelText('Distance'), '400');
    await user.type(screen.getByLabelText('Reading'), '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    inEnglish();
  });

  it('the decimal point of English, not the comma of Spanish', async () => {
    await settle(`/setups/${SETUP_ID}`);
    await screen.findByRole('table');
    expect(readable()).toMatch(/\b0\.3\b/);
    expect(readable()).not.toMatch(/\b0,3\b/);
  });
});

describe('Every public screen reads in English', () => {
  it.each([
    ['Sign in', '/sign-in'],
    ['Sign up', '/sign-up'],
    ['Forgot password', '/forgot-password'],
    ['Reset password', '/reset-password?token=abc'],
    ['Verify email', '/verify-email?token=abc'],
  ])('%s', async (_name, path) => {
    // The browser asked for English: that is the language until a profile says otherwise.
    usePreferences.setState({ locale: 'en' });
    renderApp(path, server(false).fetch);
    await waitFor(() => expect(document.querySelector('h1,h2')).not.toBeNull());
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    inEnglish();
  });
});
