import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ANA, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

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

const setup = {
  id: SETUP_ID,
  ...STAMPS,
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
    scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
  },
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

// The author's good set (Goldtip Hunter 400), and the same with 40 m written 0,8 off.
const GOOD = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6), mark(50, 2.6), mark(60, 3.6)];
const BAD = [mark(20, 0.3), mark(30, 0.8), mark(40, 2.4), mark(50, 2.6), mark(60, 3.6)];
const WRONG_WAY = [mark(20, 0.3), mark(30, 1.0), mark(40, 0.9)];

function server(marks: ReturnType<typeof mark>[]) {
  return fakeApi({
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
    'GET /api/v1/setups': () => json({ items: [setup], nextCursor: null }),
    [`GET /api/v1/setups/${SETUP_ID}`]: () => json(setup),
    [`GET /api/v1/setups/${SETUP_ID}/marks`]: () => json({ items: marks }),
  });
}

const open = (api: ReturnType<typeof server>, path = `/setups/${SETUP_ID}/doctor`) =>
  renderApp(path, api.fetch);

const rowOf = async (distance: string) => {
  const table = await screen.findByRole('table');
  const row = within(table)
    .getAllByRole('row')
    .find((r) => within(r).queryByText(distance) !== null);
  if (row === undefined) throw new Error(`no row for ${distance}`);
  return within(row);
};

describe('The Mark Doctor screen (HU-CAL-04)', () => {
  it('needs 2 marks and says how many there are', async () => {
    open(server([mark(30, 0.8)]));
    expect(
      await screen.findByText('El Doctor necesita al menos 2 marcas para revisar. Tenés 1.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('calls 5 consistent marks consistent and shows how far each one is from the trend', async () => {
    open(server(GOOD));
    expect(
      await screen.findByRole('heading', { name: 'Tus marcas son consistentes' }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveAttribute('data-verdict', 'ok');
    const forty = await rowOf('40 m');
    expect(forty.getByText('Coherente')).toBeInTheDocument();
    expect(forty.getByText(/^[+−]\d+,\d+ cm$/)).toBeInTheDocument();
    expect(forty.getByText(/Tolera ±/)).toBeInTheDocument();
  });

  it('points at the mark 0,8 cm off the trend, with its magnitude on the sight, and asks to shoot again', async () => {
    open(server(BAD));
    expect(
      await screen.findByRole('heading', { name: 'Una marca se aparta de la tendencia' }),
    ).toBeVisible();
    expect(
      screen.getByText(/Volvé a tirar 40 m: se aparta \d,\d+ cm de la tendencia\./),
    ).toBeVisible();
    const forty = await rowOf('40 m');
    expect(forty.getByText('Sospechosa')).toBeInTheDocument();
    expect(forty.getByText(/^\+\d,\d+ cm$/)).toBeInTheDocument();
    // The others are not accused.
    expect((await rowOf('20 m')).queryByText('Sospechosa')).toBeNull();
  });

  it('changes nothing: it only reads, and the mark keeps what the archer loaded', async () => {
    const api = server(BAD);
    open(api);
    await rowOf('40 m');
    expect(api.calls.every((call) => call.startsWith('GET '))).toBe(true);
    expect((await rowOf('40 m')).getByText('2,4')).toBeInTheDocument();
  });

  it('takes the archer to the suspect mark on the sight screen', async () => {
    const user = userEvent.setup();
    const { app } = open(server(BAD));
    await user.click(await screen.findByRole('button', { name: 'Ir a la marca de 40 m' }));
    await screen.findByRole('table');
    expect(app.router.state.location.pathname).toBe(`/setups/${SETUP_ID}`);
    expect(app.router.state.location.search).toMatchObject({ d: 40, arrowSet: ARROW_ID });
  });

  it('flags a pair that moves the wrong way with 3 marks, and says it checks no more than that', async () => {
    open(server(WRONG_WAY));
    expect(
      await screen.findByRole('heading', { name: 'Hay marcas que se mueven en sentido contrario' }),
    ).toBeVisible();
    expect(
      screen.getByText(/Las marcas de 30 m y 40 m se mueven en sentido contrario/),
    ).toBeVisible();
    expect((await rowOf('30 m')).getByText('Inconsistente')).toBeInTheDocument();
    expect((await rowOf('40 m')).getByText('Inconsistente')).toBeInTheDocument();
    expect((await rowOf('20 m')).getByText('Coherente')).toBeInTheDocument();
    expect(
      screen.getByText(/Con menos de 5 marcas el Doctor solo comprueba el sentido/),
    ).toBeVisible();
  });
});

describe('Getting to the Doctor from the sight screen', () => {
  it('opens from the tools with 5 marks, on the same arrow set', async () => {
    const user = userEvent.setup();
    const { app } = open(server(GOOD), `/setups/${SETUP_ID}`);
    await user.click(await screen.findByRole('link', { name: 'Doctor' }));
    expect(await screen.findByRole('heading', { name: 'Mark Doctor', level: 1 })).toBeVisible();
    expect(app.router.state.location.pathname).toBe(`/setups/${SETUP_ID}/doctor`);
    expect(app.router.state.location.search).toMatchObject({ arrowSet: ARROW_ID });
  });

  it('is there but unavailable with 3 marks, saying how many it needs', async () => {
    open(server(WRONG_WAY), `/setups/${SETUP_ID}`);
    await screen.findByRole('table');
    const tool = screen.getByText('Doctor').closest('button');
    expect(tool).toHaveAttribute('aria-disabled', 'true');
    expect(within(tool as HTMLElement).getByText('3/5')).toBeInTheDocument();
  });
});
