import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { allUnits, ANA, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

const PROFILE = {
  locale: 'es',
  units: { marks: 'metric', bow: 'imperial', arrows: 'imperial', sight: 'metric' },
  theme: 'system',
  doctorToleranceMm: null as number | null,
  quickAccess: null,
  deletionRequestedAt: null,
  version: 1,
};

/** One profile on the server, patched like the real one: the version grows with each change. */
function toleranceServer(start: Partial<typeof PROFILE> = {}) {
  let current = { ...PROFILE, ...start };
  const patches: Record<string, unknown>[] = [];
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(ANA),
    'GET /api/v1/me': () => json(current),
    'PATCH /api/v1/me/preferences': async (request) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      current = { ...current, ...body, version: current.version + 1 };
      return json(current);
    },
  });
  return { ...api, patches };
}

const main = () => within(screen.getByRole('main'));

/** The screen is split from the shell: wait for its heading before reading inside it. */
const ready = async () => {
  await screen.findByRole('heading', { name: 'Doctor', level: 1 });
  return main();
};

describe('Doctor tolerance (RF-CAL-09, HU-CAL-06)', () => {
  it('explains the threshold with the default worked out: 4 mm inside, 10 mm at the ends', async () => {
    renderApp('/doctor', toleranceServer().fetch);
    expect(await screen.findByRole('heading', { name: 'Doctor', level: 1 })).toBeInTheDocument();
    expect(
      main().getByText(/el mayor entre tu tolerancia y el paso más chico/),
    ).toBeInTheDocument();
    expect(main().getByText(/2,5 veces mayor/)).toBeInTheDocument();
    expect(
      main().getByText(/se aparta 4 mm o más; la más corta y la más larga, 10 mm/),
    ).toBeInTheDocument();
    const select = await (await ready()).findByLabelText('Tolerancia base');
    expect(select).toHaveValue('4');
    expect(main().getByRole('option', { name: '4 mm (por defecto)' })).toBeInTheDocument();
    expect(main().getByRole('button', { name: 'Volver al valor por defecto' })).toBeDisabled();
  });

  it('saves a new tolerance for every setup, and the example follows it', async () => {
    const api = toleranceServer();
    renderApp('/doctor', api.fetch);
    await userEvent.selectOptions(await (await ready()).findByLabelText('Tolerancia base'), '6');
    await waitFor(() => expect(api.patches).toEqual([{ doctorToleranceMm: 6 }]));
    expect(
      main().getByText(/se aparta 6 mm o más; la más corta y la más larga, 15 mm/),
    ).toBeVisible();
    expect(main().getByRole('button', { name: 'Volver al valor por defecto' })).toBeEnabled();
  });

  it('goes back to the default by storing null, so a recalibration reaches the archer', async () => {
    const api = toleranceServer({ doctorToleranceMm: 6 });
    renderApp('/doctor', api.fetch);
    await userEvent.click(
      await (await ready()).findByRole('button', { name: 'Volver al valor por defecto' }),
    );
    await waitFor(() => expect(api.patches).toEqual([{ doctorToleranceMm: null }]));
    expect(main().getByLabelText('Tolerancia base')).toHaveValue('4');
  });

  it('picking 4 mm in the list is the default too: null, not 4', async () => {
    const api = toleranceServer({ doctorToleranceMm: 6 });
    renderApp('/doctor', api.fetch);
    await userEvent.selectOptions(await (await ready()).findByLabelText('Tolerancia base'), '4');
    await waitFor(() => expect(api.patches).toEqual([{ doctorToleranceMm: null }]));
  });

  it('warns at 1 mm that good marks get flagged too', async () => {
    renderApp('/doctor', toleranceServer({ doctorToleranceMm: 1 }).fetch);
    expect(
      await (await ready()).findByText('Con 1 mm puede señalar marcas bien medidas.'),
    ).toBeInTheDocument();
  });

  it('adds the inches when the sight section is imperial', async () => {
    renderApp('/doctor', toleranceServer({ units: allUnits('imperial') }).fetch);
    expect(await (await ready()).findByLabelText('Tolerancia base')).toHaveAccessibleDescription(
      /Equivale a 0,157 in\./,
    );
  });
});
