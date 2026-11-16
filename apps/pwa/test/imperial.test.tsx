import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ANA, errorEnvelope, fakeApi, json } from './fake-api.js';
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

const YD = 0.9144;
/** A mark at a distance typed in yards, as an archer in yards would have shot it. */
const mark = (yards: number, reading: number) => ({
  id: `01927e5a-0000-7000-8000-000000000${String(yards).padStart(3, '0')}`,
  ...STAMPS,
  setupId: SETUP_ID,
  arrowSetId: ARROW_ID,
  distanceM: Number((yards * YD).toFixed(3)),
  scaleValueMm: reading * 10,
  origin: 'measured',
  measuredAt: '2026-11-02T12:00:00Z',
});

const MARKS = [mark(20, 0.3), mark(30, 0.8), mark(40, 1.6)];

type Handler = (request: Request) => Response | Promise<Response>;

function imperialServer(initial = MARKS, extra: Record<string, Handler> = {}) {
  // The server remembers what it is given, as the real one does: a refetch must not undo a save.
  let marks = [...initial];
  const sent: { method: string; path: string; body: unknown }[] = [];
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () =>
      json({
        locale: 'es',
        unitSystem: 'imperial',
        theme: 'system',
        quickAccess: null,
        deletionRequestedAt: null,
        version: 1,
      }),
    'GET /api/v1/setups': () => json({ items: [setup], nextCursor: null }),
    [`GET /api/v1/setups/${SETUP_ID}`]: () => json(setup),
    [`GET /api/v1/setups/${SETUP_ID}/marks`]: () => json({ items: marks }),
    'POST /api/v1/marks': async (request) => {
      const body = (await request.clone().json()) as {
        id: string;
        distanceM: number;
        scaleValueMm: number;
      };
      sent.push({ method: 'POST', path: '/api/v1/marks', body });
      const saved = { ...mark(1, 0), ...body, origin: 'measured' };
      marks = [...marks, saved].sort((a, b) => a.distanceM - b.distanceM);
      return json(saved, 201);
    },
    ...extra,
  });
  return { ...api, sent };
}

/** A metric distance or length on screen: `40 m`, `45,5 m`, `158 mm`. Yards and inches never match. */
const METRIC = /(?:^|[\s(–])\d+(?:[.,]\d+)?\s?(?:m|mm|kg)(?![\p{L}/])/u;
const noMetric = () => expect(document.body.textContent ?? '').not.toMatch(METRIC);

describe('The critical flow in yards (F1-12)', () => {
  it('shows the marks in yards, whole yards without a decimal, and nothing in metres', async () => {
    renderApp(`/setups/${SETUP_ID}`, imperialServer().fetch);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getByText('20 yd')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('30 yd')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('40 yd')).toBeInTheDocument();
    expect(screen.getByText('Lectura a 20 yd')).toBeInTheDocument();
    expect(screen.getByText(/Marcas: 3 · 20–40 yd/)).toBeInTheDocument();
    noMetric();
  });

  it('takes a distance typed in yards and sends it in metres', async () => {
    const user = userEvent.setup();
    const api = imperialServer();
    renderApp(`/setups/${SETUP_ID}`, api.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    expect(screen.getByText('yd')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Distancia'), '50');
    await user.type(screen.getByLabelText('Lectura'), '2,6');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Marca guardada')).toBeInTheDocument();
    // 50 yd is exactly 45.72 m: the canonical value goes to the API, the yards stay on screen.
    expect(api.sent[0]?.body).toMatchObject({ distanceM: 45.72, scaleValueMm: 26 });
    expect(await screen.findByRole('button', { name: 'Elegir la marca de 50 yd' })).toBeVisible();
    noMetric();
  });

  it('reads the distance steppers in yards', async () => {
    const user = userEvent.setup();
    renderApp(`/setups/${SETUP_ID}`, imperialServer().fetch);
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '50');
    await user.click(screen.getByRole('button', { name: 'Distancia más' }));
    expect(screen.getByLabelText('Distancia')).toHaveValue('51');
  });

  it('asks about a duplicate in yards', async () => {
    const user = userEvent.setup();
    const api = imperialServer(MARKS, {
      'POST /api/v1/marks': () =>
        json(
          {
            success: false,
            error: {
              code: 'SM-MARK-409-001',
              messageKey: 'errors.mark.duplicateDistance',
              params: { existingMarkId: (MARKS[1] as { id: string }).id, distanceM: 27.432 },
              requestId: 'r1',
              timestamp: '2026-11-02T12:00:00Z',
            },
          },
          409,
        ),
    });
    renderApp(`/setups/${SETUP_ID}`, api.fetch);
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '30');
    await user.type(screen.getByLabelText('Lectura'), '0,9');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText(/Ya tenés 30 yd → 0,8\. ¿Reemplazar por 0,9\?/),
    ).toBeInTheDocument();
  });

  it('says an API refusal in yards and in readings of the sight, not in metres or mm', async () => {
    const user = userEvent.setup();
    const api = imperialServer(MARKS, {
      'POST /api/v1/marks': () =>
        json(
          {
            success: false,
            error: {
              code: 'SM-MARK-422-001',
              messageKey: 'errors.mark.outOfScale',
              params: { minMm: 0, maxMm: 100 },
              requestId: 'r1',
              timestamp: '2026-11-02T12:00:00Z',
            },
          },
          422,
        ),
    });
    renderApp(`/setups/${SETUP_ID}`, api.fetch);
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '50');
    await user.type(screen.getByLabelText('Lectura'), '2,6');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('La lectura está fuera de la escala de la mira (0,0–10,0).'),
    ).toBeInTheDocument();
  });

  it('opens the intermediates on whole yards: 20 to 40 every 5, and a query in yards', async () => {
    const user = userEvent.setup();
    renderApp(`/setups/${SETUP_ID}/distances`, imperialServer().fetch);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('button')[0]?.textContent)).toEqual([
      '20 yd',
      '25 yd',
      '30 yd',
      '35 yd',
      '40 yd',
    ]);
    expect(screen.getByLabelText('Desde')).toHaveValue('20');
    expect(screen.getByLabelText('Hasta')).toHaveValue('40');

    await user.type(screen.getByLabelText('Distancia'), '33');
    await user.click(screen.getByRole('button', { name: 'Ver lectura' }));
    expect(await screen.findByText(/^33 yd/, { selector: 'p' })).toHaveTextContent(/≈ \d/);
    noMetric();
  });

  it('asks a distance beyond the marks in yards when it cannot be estimated', async () => {
    const user = userEvent.setup();
    renderApp(`/setups/${SETUP_ID}/distances`, imperialServer(MARKS.slice(0, 2)).fetch);
    await screen.findByRole('button', { name: 'Ver lectura' });
    await user.type(screen.getByLabelText('Distancia'), '50');
    await user.click(screen.getByRole('button', { name: 'Ver lectura' }));
    expect(await screen.findByText(/3 marcas/, { selector: 'span' })).toBeInTheDocument();
    noMetric();
  });

  it('shows the Doctor in yards too', async () => {
    const marks = [mark(20, 0.3), mark(30, 0.8), mark(40, 2.4), mark(50, 2.6), mark(60, 3.6)];
    renderApp(`/setups/${SETUP_ID}/doctor`, imperialServer(marks).fetch);
    expect(await screen.findByText(/Volvé a tirar 40 yd: se aparta/)).toBeInTheDocument();
    noMetric();
  });

  it('keeps an unreadable API error from showing its placeholders', async () => {
    const api = imperialServer(MARKS, {
      [`GET /api/v1/setups/${SETUP_ID}/marks`]: () =>
        errorEnvelope('SM-CORE-404-001', 'errors.core.notFound', 404),
    });
    renderApp(`/setups/${SETUP_ID}`, api.fetch);
    await waitFor(() => expect(screen.getByText('No pudimos cargar las marcas')).toBeVisible());
    expect(document.body.textContent).not.toMatch(/\{\{/);
  });
});
