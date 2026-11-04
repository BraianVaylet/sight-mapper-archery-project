import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
  },
  arrowSets: [{ id: ARROW_ID, status: 'active', name: 'Hunter 400' }],
  marksCount: 0,
};

let markCount = 0;
const mark = (distanceM: number, reading: number) => ({
  id: `01927e5a-0000-7000-8000-${String(++markCount).padStart(12, '0')}`,
  ...STAMPS,
  setupId: SETUP_ID,
  arrowSetId: ARROW_ID,
  distanceM,
  scaleValueMm: reading * 10,
  origin: 'measured',
  measuredAt: '2026-11-02T12:00:00Z',
});

const HUNTER = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6), mark(50, 2.6), mark(60, 3.6)];

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

const open = (marks: ReturnType<typeof mark>[], search = '', system?: 'metric' | 'imperial') =>
  renderApp(`/setups/${SETUP_ID}/print${search}`, server(marks, system).fetch);

const sheet = async () => within(await screen.findByRole('article', { name: 'Marcas de mira' }));
const rowsOf = async () => {
  const s = await sheet();
  return s.getAllByRole('row').slice(1);
};

describe('The printable list (HU-CAL-05)', () => {
  it('heads the sheet with the setup, the bow, the sight, the arrows, the date and the unit', async () => {
    open(HUNTER);
    const s = await sheet();
    expect(s.getByRole('heading', { name: 'Marcas de mira' })).toBeInTheDocument();
    expect(s.getByText('Hunting')).toBeInTheDocument();
    expect(s.getByText('Hoyt Alpha')).toBeInTheDocument();
    expect(s.getByText('Ultraview')).toBeInTheDocument();
    expect(s.getByText('Hunter 400')).toBeInTheDocument();
    expect(s.getByText('Fecha')).toBeInTheDocument();
    expect(s.getByText(/\b20\d\d\b/)).toBeInTheDocument();
    expect(s.getByText('Distancias')).toBeInTheDocument();
    expect(s.getByText('En m, cada 5')).toBeInTheDocument();
  });

  it('lists 20 to 60 every 5: measured plain and exact, the rest with ≈', async () => {
    open(HUNTER);
    const rows = await rowsOf();
    expect(rows).toHaveLength(9);
    const at20 = within(rows[0] as HTMLElement);
    expect(at20.getByText('20 m')).toBeInTheDocument();
    expect(at20.getByText('0,3')).toBeInTheDocument();
    const at25 = within(rows[1] as HTMLElement);
    expect(at25.getByText('25 m')).toBeInTheDocument();
    expect(at25.getByText(/^≈ \d,\d$/)).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute('data-measured', 'true');
    expect(rows[1]).toHaveAttribute('data-measured', 'false');
  });

  it('explains the signs in a footnote, only the ones it uses', async () => {
    open(HUNTER);
    const s = await sheet();
    expect(await s.findByText('Sin símbolo: medida por vos.')).toBeInTheDocument();
    expect(s.getByText(/^≈ Calculada a partir de tus marcas/)).toBeInTheDocument();
    expect(s.queryByText(/^\* Poca confianza/)).toBeNull();
  });

  it('has no ≈ footnote when every row was measured', async () => {
    open(HUNTER, '?step=10');
    const s = await sheet();
    await s.findByText('60 m');
    expect(s.queryByText(/^≈ Calculada/)).toBeNull();
  });

  it('marks with * what to confirm at the range, and says so', async () => {
    open(HUNTER, '?from=10&to=90&step=10');
    const s = await sheet();
    await s.findByText('90 m');
    expect(s.getAllByText(/ \*$/).length).toBeGreaterThan(0);
    expect(s.getByText(/^\* Poca confianza o fuera de la escala/)).toBeInTheDocument();
  });

  it('prints the way the archer asked: the step is in the URL and on the sheet', async () => {
    const user = userEvent.setup();
    const { app } = open(HUNTER);
    await rowsOf();
    await user.click(screen.getByRole('radio', { name: '10' }));
    expect(await rowsOf()).toHaveLength(5);
    expect(app.router.state.location.search).toMatchObject({ step: 10 });
    expect((await sheet()).getByText('En m, cada 10')).toBeInTheDocument();
  });

  it('opens the print dialog of the browser', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    open(HUNTER);
    await user.click(await screen.findByRole('button', { name: 'Imprimir' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('keeps what is not paper apart, so the stylesheet can leave it out of the page', async () => {
    open(HUNTER);
    const s = await screen.findByRole('article', { name: 'Marcas de mira' });
    expect(s).toHaveClass('print-sheet');
    // The button, the controls and the hint live outside the sheet.
    expect(s.contains(screen.getByRole('button', { name: 'Imprimir' }))).toBe(false);
    expect(s.contains(screen.getByLabelText('Desde'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Imprimir' }).closest('.no-print')).not.toBeNull();
  });

  it('says there is nothing to print without marks, and offers no button', async () => {
    open([]);
    expect(
      await screen.findByText('Todavía no hay marcas para imprimir. Cargá al menos una.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Imprimir' })).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('asks to fix a range that makes no sense instead of printing an empty page', async () => {
    open(HUNTER, '?from=60&to=20');
    expect(await screen.findByText(/«Desde» tiene que ser mayor que 0/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Imprimir' })).toBeNull();
  });

  it('leaves out and counts the distances the marks do not allow (2 marks: no extrapolation)', async () => {
    open([mark(20, 0.3), mark(40, 1.6)], '?from=20&to=60&step=10');
    const s = await sheet();
    expect(
      await s.findByText('No se incluyen 2 distancias que tus marcas no permiten estimar.'),
    ).toBeInTheDocument();
    expect(await rowsOf()).toHaveLength(3);
  });

  it('prints in yards for an archer in yards', async () => {
    open([mark(18.288, 0.3), mark(27.432, 0.8), mark(36.576, 1.6)], '', 'imperial');
    const s = await sheet();
    expect(await s.findByText('En yd, cada 5')).toBeInTheDocument();
    expect(s.getByText('20 yd')).toBeInTheDocument();
    expect(s.getByText('40 yd')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d\s?m\b(?!\/)/);
  });
});

describe('Getting to the print screen from the sight screen', () => {
  it('opens from the tools with 1 mark, on the same arrow set', async () => {
    const user = userEvent.setup();
    const { app } = renderApp(`/setups/${SETUP_ID}`, server([mark(30, 0.8)]).fetch);
    await user.click(await screen.findByRole('link', { name: 'Imprimir' }));
    expect(
      await screen.findByRole('heading', { name: 'Listado imprimible', level: 1 }),
    ).toBeVisible();
    expect(app.router.state.location.pathname).toBe(`/setups/${SETUP_ID}/print`);
    expect(app.router.state.location.search).toMatchObject({ arrowSet: ARROW_ID });
  });

  it('is there but unavailable without marks', async () => {
    renderApp(`/setups/${SETUP_ID}`, server([]).fetch);
    await screen.findByText('Todavía no hay marcas');
    const tool = screen.getByText('Imprimir').closest('button');
    expect(tool).toHaveAttribute('aria-disabled', 'true');
    expect(within(tool as HTMLElement).getByText('0/1')).toBeInTheDocument();
  });
});
