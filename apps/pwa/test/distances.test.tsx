import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ANA, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

const BOW_ID = '01927e5a-0000-7000-8000-0000000000b1';
const SIGHT_ID = '01927e5a-0000-7000-8000-0000000000c1';
const ARROW_ID = '01927e5a-0000-7000-8000-0000000000d1';
const SETUP_ID = '01927e5a-0000-7000-8000-0000000000e1';
const SCALE = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' };
const STAMPS = {
  version: 1,
  createdAt: '2026-11-02T12:00:00Z',
  updatedAt: '2026-11-02T12:00:00Z',
  deletedAt: null,
};

const setup = {
  id: SETUP_ID,
  ...STAMPS,
  bowId: BOW_ID,
  sightId: SIGHT_ID,
  arrowSetIds: [ARROW_ID],
  isFavorite: false,
  status: 'active',
  bow: { id: BOW_ID, status: 'active', manufacturer: 'Hoyt', model: 'Alpha' },
  sight: { id: SIGHT_ID, status: 'active', model: 'Ultraview', pinType: 'dualpin', scale: SCALE },
  arrowSets: [{ id: ARROW_ID, status: 'active', name: 'Hunter 400' }],
  marksCount: 0,
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

// The author's good set (Goldtip Hunter 400).
const HUNTER = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6), mark(50, 2.6), mark(60, 3.6)];
const TWO = [mark(20, 0.3), mark(40, 1.6)];

function server(marks: ReturnType<typeof mark>[], unitSystem: 'metric' | 'imperial' = 'metric') {
  return fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () =>
      json({
        locale: 'es',
        unitSystem,
        theme: 'system',
        quickAccess: null,
        deletionRequestedAt: null,
        version: 1,
      }),
    'GET /api/v1/setups': () => json({ items: [setup], nextCursor: null }),
    [`GET /api/v1/setups/${SETUP_ID}`]: () => json(setup),
    [`GET /api/v1/setups/${SETUP_ID}/marks`]: () => json({ items: marks }),
  });
}

const open = (api: ReturnType<typeof server>, search = '') =>
  renderApp(`/setups/${SETUP_ID}/distances${search}`, api.fetch);

const rowsOf = async () => {
  const table = await screen.findByRole('table');
  return within(table).getAllByRole('row').slice(1);
};

describe('Intermediate distances (HU-CAL-01, HU-CAL-02)', () => {
  it('does not offer to calculate with fewer than 2 marks, and says how many are missing', async () => {
    open(server([mark(30, 0.8)]));
    expect(
      await screen.findByText('El cálculo necesita al menos 2 marcas. Tenés 1.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver lectura' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('opens on the measured range with a step of 5: measured as loaded, the rest estimated', async () => {
    open(server(HUNTER));
    const rows = await rowsOf();
    expect(rows).toHaveLength(9);
    const first = within(rows[0] as HTMLElement);
    expect(first.getByText('20 m')).toBeInTheDocument();
    expect(first.getByText('0,3')).toBeInTheDocument();
    expect(first.getByText('Registrada')).toBeInTheDocument();
    const second = within(rows[1] as HTMLElement);
    expect(second.getByText('25 m')).toBeInTheDocument();
    expect(second.getByText(/^≈ \d/)).toBeInTheDocument();
    expect(second.getByText('Calculada')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('0,8')).toBeInTheDocument();
  });

  it('draws the curve: measured dots on a solid line, estimates as diamonds on a dashed one', async () => {
    open(server(HUNTER));
    const curve = await screen.findByRole('img', {
      name: 'Curva: distancia contra lectura de la mira',
    });
    expect(curve.querySelectorAll('[data-point="measured"]')).toHaveLength(5);
    expect(curve.querySelectorAll('[data-point="estimated"]')).toHaveLength(4);
    expect(curve.querySelectorAll('[data-line="solid"]')).toHaveLength(0);
    expect(curve.querySelectorAll('[data-line="dashed"]')).toHaveLength(8);
  });

  it('draws the line solid when the step lands only on measured marks', async () => {
    open(server(HUNTER), '?step=10');
    const curve = await screen.findByRole('img', {
      name: 'Curva: distancia contra lectura de la mira',
    });
    expect(curve.querySelectorAll('[data-line="solid"]')).toHaveLength(4);
    expect(curve.querySelectorAll('[data-line="dashed"]')).toHaveLength(0);
  });

  it('changes the step and keeps it in the URL', async () => {
    const user = userEvent.setup();
    const { app } = open(server(HUNTER));
    await rowsOf();
    await user.click(screen.getByRole('radio', { name: '10' }));
    await waitFor(async () => expect(await rowsOf()).toHaveLength(5));
    expect(app.router.state.location.search).toMatchObject({ step: 10 });
  });

  it('takes the range the archer types, and says so when it makes no sense', async () => {
    const user = userEvent.setup();
    open(server(HUNTER));
    await rowsOf();

    await user.clear(screen.getByLabelText('Hasta'));
    await user.type(screen.getByLabelText('Hasta'), '40');
    expect(await rowsOf()).toHaveLength(5);

    await user.clear(screen.getByLabelText('Desde'));
    await user.type(screen.getByLabelText('Desde'), '70');
    expect(
      await screen.findByText(/«Desde» tiene que ser mayor que 0 y no pasar «Hasta»/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('lists a grid of yards for an archer in yards, 20, 25, 30 yd, not metres converted', async () => {
    open(server(HUNTER, 'imperial'), '?from=25&to=35');
    await waitFor(async () => {
      const rows = await rowsOf();
      expect(rows.map((r) => within(r).getAllByRole('button')[0]?.textContent)).toEqual([
        '25 yd',
        '30 yd',
        '35 yd',
      ]);
    });
  });

  it('says why a distance is not allowed instead of leaving a hole (2 marks: no extrapolation)', async () => {
    open(server(TWO), '?from=20&to=50&step=10');
    const rows = await rowsOf();
    expect(rows).toHaveLength(4);
    const beyond = within(rows[3] as HTMLElement);
    expect(beyond.getByText('—')).toBeInTheDocument();
    expect(beyond.getByText(/3 marcas/)).toBeInTheDocument();
  });

  it('selects a row and shows its reading at the top, in the URL', async () => {
    const user = userEvent.setup();
    const { app } = open(server(HUNTER));
    await rowsOf();
    await user.click(screen.getByRole('button', { name: 'Elegir 40 m' }));
    expect(await screen.findByText(/^40 m/, { selector: 'p' })).toBeInTheDocument();
    expect(app.router.state.location.search).toMatchObject({ d: 40 });
    expect(screen.getByRole('button', { name: 'Elegir 40 m' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

describe('Look up a distance (HU-CAL-03)', () => {
  it('estimates a distance nobody shot, draws it apart, and changes no mark', async () => {
    const user = userEvent.setup();
    const api = server(HUNTER);
    const { app } = open(api, '?step=10');
    await rowsOf();

    await user.type(screen.getByLabelText('Distancia'), '45');
    await user.click(screen.getByRole('button', { name: 'Ver lectura' }));

    // The big readout carries the estimate flag; a measured reading would not have it.
    expect(await screen.findByText(/^45 m/, { selector: 'p' })).toHaveTextContent(/≈ \d/);
    expect(app.router.state.location.search).toMatchObject({ d: 45 });
    const curve = screen.getByRole('img', { name: 'Curva: distancia contra lectura de la mira' });
    expect(curve.querySelectorAll('[data-point="query"]')).toHaveLength(1);
    // Nothing but reads: no mark was created, changed or deleted.
    expect(api.calls.every((call) => call.startsWith('GET '))).toBe(true);
  });

  it('asks for a number, and for a distance that can be shot', async () => {
    const user = userEvent.setup();
    open(server(HUNTER));
    await rowsOf();

    await user.click(screen.getByRole('button', { name: 'Ver lectura' }));
    expect(screen.getByText('Completá este campo.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Distancia'), '400');
    await user.click(screen.getByRole('button', { name: 'Ver lectura' }));
    expect(screen.getByText(/La distancia debe ser mayor que 0 y de hasta 300 m/)).toBeVisible();
  });

  it('answers with the missing marks when it is beyond what 2 marks allow', async () => {
    const user = userEvent.setup();
    open(server(TWO));
    await screen.findByRole('button', { name: 'Ver lectura' });
    await user.type(screen.getByLabelText('Distancia'), '50');
    await user.click(screen.getByRole('button', { name: 'Ver lectura' }));
    expect(await screen.findByText(/3 marcas/, { selector: 'span' })).toBeInTheDocument();
  });
});

describe('Getting here from the sight screen', () => {
  it('opens from the tools once there are 2 marks, on the same arrow set', async () => {
    const user = userEvent.setup();
    const { app } = renderApp(`/setups/${SETUP_ID}`, server(HUNTER).fetch);
    await user.click(await screen.findByRole('link', { name: 'Intermedias' }));
    expect(await screen.findByRole('heading', { name: 'Distancias', level: 1 })).toBeVisible();
    expect(app.router.state.location.pathname).toBe(`/setups/${SETUP_ID}/distances`);
    expect(app.router.state.location.search).toMatchObject({ arrowSet: ARROW_ID });
  });

  it('is there but unavailable with a single mark, saying how many it needs', async () => {
    renderApp(`/setups/${SETUP_ID}`, server([mark(30, 0.8)]).fetch);
    await screen.findByRole('table');
    const tool = screen.getByText('Intermedias').closest('button');
    expect(tool).toHaveAttribute('aria-disabled', 'true');
    expect(within(tool as HTMLElement).getByText('1/2')).toBeInTheDocument();
  });
});
