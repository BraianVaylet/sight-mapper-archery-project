import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { allUnits, ANA, errorEnvelope, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

const PROFILE = {
  locale: 'es',
  units: allUnits('metric'),
  theme: 'system',
  quickAccess: null,
  deletionRequestedAt: null,
  version: 1,
};

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
  sight: {
    id: SIGHT_ID,
    status: 'active',
    model: 'Ultraview',
    pinType: 'dualpin',
    scale: SCALE,
  },
  arrowSets: [{ id: ARROW_ID, status: 'active', name: 'Hunter 400' }],
  marksCount: 0,
};

/** A measured mark. `reading` is in the scale's own unit (cm); the API speaks millimetres. */
const mark = (id: string, distanceM: number, reading: number, windageMm: number | null = null) => ({
  id,
  ...STAMPS,
  setupId: SETUP_ID,
  arrowSetId: ARROW_ID,
  distanceM,
  scaleValueMm: reading * 10,
  windageMm,
  origin: 'measured',
  measuredAt: '2026-11-02T12:00:00Z',
});

const M20 = '01927e5a-0000-7000-8000-000000000a20';
const M30 = '01927e5a-0000-7000-8000-000000000a30';
const M40 = '01927e5a-0000-7000-8000-000000000a40';

type Handler = (request: Request) => Response | Promise<Response>;
type Sent = { method: string; path: string; body: unknown; headers: Headers };

/** A server that remembers the marks, as the real one does: a refetch must not undo a save. */
function sightServer(initial: ReturnType<typeof mark>[], extra: Record<string, Handler> = {}) {
  let marks = [...initial];
  const sent: Sent[] = [];
  const record = async (request: Request) => {
    const text = await request.clone().text();
    const entry: Sent = {
      method: request.method,
      path: new URL(request.url).pathname,
      body: text === '' ? undefined : JSON.parse(text),
      headers: request.headers,
    };
    sent.push(entry);
    return entry;
  };
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () => json(PROFILE),
    'GET /api/v1/setups': () => json({ items: [setup], nextCursor: null }),
    [`GET /api/v1/setups/${SETUP_ID}`]: () => json(setup),
    [`GET /api/v1/setups/${SETUP_ID}/marks`]: () => json({ items: marks }),
    'POST /api/v1/marks': async (request) => {
      const { body } = await record(request);
      const input = body as {
        id: string;
        distanceM: number;
        scaleValueMm: number;
        windageMm?: number | null;
        replace: boolean;
      };
      const same = marks.find((m) => m.distanceM === input.distanceM);
      if (same !== undefined && !input.replace) {
        return json(
          {
            success: false,
            error: {
              code: 'SM-MARK-409-001',
              messageKey: 'errors.mark.duplicateDistance',
              params: { existingMarkId: same.id, distanceM: input.distanceM },
              requestId: 'r1',
              timestamp: '2026-11-02T12:00:00Z',
            },
          },
          409,
        );
      }
      const saved =
        same === undefined
          ? mark(input.id, input.distanceM, input.scaleValueMm / 10, input.windageMm ?? null)
          : {
              ...same,
              version: same.version + 1,
              scaleValueMm: input.scaleValueMm,
              windageMm: input.windageMm ?? null,
            };
      marks = [...marks.filter((m) => m.id !== saved.id), saved].sort(
        (a, b) => a.distanceM - b.distanceM,
      );
      return json(saved, same === undefined ? 201 : 200);
    },
    [`PATCH /api/v1/marks/${M30}`]: async (request) => {
      const { body } = await record(request);
      const patch = body as { scaleValueMm?: number; windageMm?: number | null };
      const current = marks.find((m) => m.id === M30);
      if (current === undefined)
        return errorEnvelope('SM-CORE-404-001', 'errors.core.notFound', 404);
      const saved = {
        ...current,
        version: current.version + 1,
        ...(patch.scaleValueMm === undefined ? {} : { scaleValueMm: patch.scaleValueMm }),
        ...(patch.windageMm === undefined ? {} : { windageMm: patch.windageMm }),
      };
      marks = marks.map((m) => (m.id === M30 ? saved : m));
      return json(saved);
    },
    [`DELETE /api/v1/marks/${M30}`]: async (request) => {
      await record(request);
      // As the real API: no version, no delete.
      if (request.headers.get('If-Match') === null) {
        return errorEnvelope('SM-CORE-428-001', 'errors.core.preconditionRequired', 428);
      }
      marks = marks.filter((m) => m.id !== M30);
      return new Response(null, { status: 204 });
    },
    [`POST /api/v1/marks/${M30}/restore`]: async (request) => {
      await record(request);
      const back = mark(M30, 30, 0.8);
      marks = [...marks, back].sort((a, b) => a.distanceM - b.distanceM);
      return json(back);
    },
    ...extra,
  });
  return { ...api, sent, marks: () => marks };
}

const THREE = [mark(M20, 20, 0.3), mark(M30, 30, 0.8), mark(M40, 40, 1.6)];

describe('The sight screen (HU-MRK-04, HU-CAL-01)', () => {
  it('invites the archer to measure the first mark when there are none', async () => {
    renderApp(`/setups/${SETUP_ID}`, sightServer([]).fetch);
    expect(await screen.findByText('Todavía no hay marcas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Agregar marca' })).toBeEnabled();
  });

  it('lists the marks nearest first with their readings, and reads the nearest one out', async () => {
    renderApp(`/setups/${SETUP_ID}`, sightServer(THREE).fetch);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByText('20 m')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('0,3')).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('1,6')).toBeInTheDocument();
    expect(screen.getByText('Lectura a 20 m')).toBeInTheDocument();
  });

  it('shows a distance nobody shot as an estimate, never as a measurement', async () => {
    renderApp(`/setups/${SETUP_ID}?d=35`, sightServer(THREE).fetch);
    await screen.findByRole('table');
    expect(await screen.findByText('Lectura a 35 m')).toBeInTheDocument();
    expect(await screen.findByText('≈ 1,2', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getAllByText('Calculada').length).toBeGreaterThan(0);
  });

  it('selects a mark from the table and puts the distance in the URL', async () => {
    const user = userEvent.setup();
    const { app } = renderApp(`/setups/${SETUP_ID}`, sightServer(THREE).fetch);
    await user.click(await screen.findByRole('button', { name: 'Elegir la marca de 40 m' }));
    expect(await screen.findByText('Lectura a 40 m')).toBeInTheDocument();
    expect(app.router.state.location.search).toMatchObject({ d: 40 });
  });

  it('says which tools are not there yet and what the Doctor still needs', async () => {
    renderApp(`/setups/${SETUP_ID}`, sightServer(THREE).fetch);
    await screen.findByRole('table');
    const tools = screen.getByRole('group', { name: 'Herramientas' });
    expect(within(tools).getByText('Viento').closest('button')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(tools).getByText('3/5')).toBeInTheDocument();
    expect(within(tools).getByRole('link', { name: 'Imprimir' })).toBeInTheDocument();
  });
});

describe('The new mark sheet (HU-MRK-01)', () => {
  it('saves a mark at once: it is on the table before the toast asks to undo', async () => {
    const user = userEvent.setup();
    const server = sightServer(THREE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '50');
    await user.type(screen.getByLabelText('Lectura'), '2,6');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Marca guardada')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Elegir la marca de 50 m' })).toBeVisible();
    const post = server.sent.find((s) => s.method === 'POST' && s.path === '/api/v1/marks');
    expect(post?.body).toMatchObject({
      distanceM: 50,
      scaleValueMm: 26,
      setupId: SETUP_ID,
      arrowSetId: ARROW_ID,
    });
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('tells the archer what is wrong before asking the server', async () => {
    const user = userEvent.setup();
    const server = sightServer(THREE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getAllByText('Completá este campo.')).toHaveLength(2);

    await user.type(screen.getByLabelText('Distancia'), '400');
    await user.type(screen.getByLabelText('Lectura'), '15');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText(/La distancia debe ser mayor que 0/)).toBeInTheDocument();
    expect(server.sent.filter((s) => s.method === 'POST')).toHaveLength(0);
  });

  it('steps the reading by one resolution with the buttons', async () => {
    const user = userEvent.setup();
    renderApp(`/setups/${SETUP_ID}`, sightServer(THREE).fetch);
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.click(screen.getByRole('button', { name: 'Lectura más' }));
    await user.click(screen.getByRole('button', { name: 'Lectura más' }));
    expect(screen.getByLabelText('Lectura')).toHaveValue('0,2');
    await user.click(screen.getByRole('button', { name: 'Lectura menos' }));
    expect(screen.getByLabelText('Lectura')).toHaveValue('0,1');
  });

  it('asks before replacing the mark at a distance that already has one', async () => {
    const user = userEvent.setup();
    const server = sightServer(THREE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '30');
    await user.type(screen.getByLabelText('Lectura'), '0,9');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('¿Reemplazar la marca?')).toBeInTheDocument();
    expect(screen.getByText(/Ya tenés 30 m → 0,8\. ¿Reemplazar por 0,9\?/)).toBeInTheDocument();
    // The refused guess never reached the list: still three marks, the old one untouched.
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Elegir la marca de 30 m' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Reemplazar' }));
    await waitFor(() =>
      expect(server.sent.filter((s) => s.path === '/api/v1/marks')).toHaveLength(2),
    );
    expect(server.sent.at(-1)?.body).toMatchObject({ distanceM: 30, replace: true });
    expect(await screen.findByText('Marca guardada')).toBeInTheDocument();
    expect(server.marks().find((m) => m.id === M30)?.scaleValueMm).toBe(9);
  });

  it('keeps the current mark when the archer does not want to replace it', async () => {
    const user = userEvent.setup();
    const server = sightServer(THREE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '30');
    await user.type(screen.getByLabelText('Lectura'), '0,9');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(await screen.findByRole('button', { name: 'Conservar la actual' }));

    expect(screen.queryByText('¿Reemplazar la marca?')).not.toBeInTheDocument();
    expect(server.marks().find((m) => m.id === M30)?.scaleValueMm).toBe(8);
  });

  it('brings the sheet back with what was typed when the server refuses', async () => {
    const user = userEvent.setup();
    const server = sightServer(THREE, {
      'POST /api/v1/marks': () => errorEnvelope('SM-MARK-422-001', 'errors.mark.outOfScale', 422),
    });
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '50');
    await user.type(screen.getByLabelText('Lectura'), '2,6');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Distancia')).toHaveValue('50');
    expect(screen.getByLabelText('Lectura')).toHaveValue('2,6');
    expect(screen.queryByRole('button', { name: 'Elegir la marca de 50 m' })).toBeNull();
  });
});

describe('The edit mark sheet (HU-MRK-03)', () => {
  it('opens with the saved values and sends only a new reading with the version', async () => {
    const user = userEvent.setup();
    const server = sightServer(THREE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Editar la marca de 30 m' }));
    expect(screen.getByLabelText('Distancia')).toHaveValue('30');
    expect(screen.getByLabelText('Lectura')).toHaveValue('0,8');

    await user.clear(screen.getByLabelText('Lectura'));
    await user.type(screen.getByLabelText('Lectura'), '0,9');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Marca actualizada')).toBeInTheDocument();
    const patch = server.sent.find((s) => s.method === 'PATCH');
    expect(patch?.body).toMatchObject({ scaleValueMm: 9 });
    expect(patch?.headers.get('If-Match')).toBe('"1"');
  });

  it('deletes a mark at once and brings it back with Undo', async () => {
    const user = userEvent.setup();
    const server = sightServer(THREE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Editar la marca de 30 m' }));
    await user.click(screen.getByRole('button', { name: 'Borrar la marca' }));

    expect(await screen.findByText('Marca borrada')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Elegir la marca de 30 m' })).toBeNull(),
    );

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(await screen.findByRole('button', { name: 'Elegir la marca de 30 m' })).toBeVisible();
    expect(server.sent.some((s) => s.path === `/api/v1/marks/${M30}/restore`)).toBe(true);
    const deletion = server.sent.find((s) => s.method === 'DELETE');
    expect(deletion?.headers.get('If-Match')).toBe('"1"');
  });
});

describe('Windage (F1-42)', () => {
  /** mm, -10 to 10 in half millimetres: the horizontal scale of the sight. */
  const WINDAGE = { unit: 'mm', min: -10, max: 10, resolution: 0.5, direction: 'right' };
  const windySetup = { ...setup, sight: { ...setup.sight, windageScale: WINDAGE } };
  const windy = (marks: ReturnType<typeof mark>[]) =>
    sightServer(marks, { [`GET /api/v1/setups/${SETUP_ID}`]: () => json(windySetup) });
  const WITH_WINDAGE = [mark(M20, 20, 0.3, 2.5), mark(M30, 30, 0.8, 3), mark(M40, 40, 1.6)];

  it('reads out the windage of the selected mark, and puts it under its reading in the table', async () => {
    renderApp(`/setups/${SETUP_ID}?d=20`, windy(WITH_WINDAGE).fetch);
    await screen.findByRole('table');
    expect(screen.getAllByText('Deriva 2,5').length).toBeGreaterThanOrEqual(2);
    const row40 = screen.getByRole('button', { name: 'Elegir la marca de 40 m' }).closest('tr');
    expect(within(row40 as HTMLElement).queryByText(/Deriva/)).toBeNull();
  });

  it('draws a horizontal ruler with the marks that have a windage', async () => {
    const { container } = renderApp(`/setups/${SETUP_ID}`, windy(WITH_WINDAGE).fetch);
    const ruler = await screen.findByRole('img', { name: 'Regla de la deriva de la mira' });
    expect(ruler.querySelectorAll('[data-mark="measured"]')).toHaveLength(2);
    expect(container).toBeTruthy();
  });

  it('says how to start when the sight has no horizontal scale, in the screen and in the sheet', async () => {
    const user = userEvent.setup();
    renderApp(`/setups/${SETUP_ID}`, sightServer(THREE).fetch);
    await screen.findByRole('table');
    expect(
      screen.getByText('Esta mira no tiene escala horizontal: cargala para anotar la deriva.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    expect(screen.queryByLabelText('Deriva')).toBeNull();
    expect(screen.getByRole('link', { name: 'Cargar la escala horizontal' })).toBeInTheDocument();
  });

  it('saves a new mark with its windage', async () => {
    const user = userEvent.setup();
    const server = windy([]);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByText('Todavía no hay marcas');
    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '20');
    await user.type(screen.getByLabelText('Lectura'), '0,3');
    await user.type(screen.getByLabelText('Deriva'), '-1,5');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Marca guardada');
    expect(server.sent.find((x) => x.method === 'POST')?.body).toMatchObject({ windageMm: -1.5 });
  });

  it('clears a windage on edit, and Undo puts it back', async () => {
    const user = userEvent.setup();
    const server = windy(WITH_WINDAGE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Editar la marca de 30 m' }));
    expect(screen.getByLabelText('Deriva')).toHaveValue('3,0');
    await user.clear(screen.getByLabelText('Deriva'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Marca actualizada');
    const patches = () => server.sent.filter((x) => x.method === 'PATCH');
    expect(patches()[0]?.body).toMatchObject({ windageMm: null });
    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(patches()[1]?.body).toMatchObject({ windageMm: 3 }));
  });

  it('keeps the windage when the archer replaces the mark at a distance', async () => {
    const user = userEvent.setup();
    const server = windy(WITH_WINDAGE);
    renderApp(`/setups/${SETUP_ID}`, server.fetch);
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: '+ Agregar marca' }));
    await user.type(screen.getByLabelText('Distancia'), '40');
    await user.type(screen.getByLabelText('Lectura'), '1,7');
    await user.type(screen.getByLabelText('Deriva'), '4');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(await screen.findByRole('button', { name: 'Reemplazar' }));
    await screen.findByText('Marca guardada');
    const posts = server.sent.filter((x) => x.method === 'POST');
    expect(posts[posts.length - 1]?.body).toMatchObject({ replace: true, windageMm: 4 });
  });
});
