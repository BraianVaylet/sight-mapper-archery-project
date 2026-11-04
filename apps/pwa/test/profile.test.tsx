import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANA, errorEnvelope, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

// HU-ACC-05 (download my data) and HU-ACC-06 (ask for deletion, cancel it).

type Sent = { method: string; path: string; ifMatch: string | null; idempotencyKey: string | null };
type Handler = (request: Request) => Response | Promise<Response>;

const EXPORT = {
  schemaVersion: 1,
  exportedAt: '2026-11-02T12:00:00Z',
  profile: {
    locale: 'es',
    unitSystem: 'metric',
    theme: 'system',
    quickAccess: null,
    deletionRequestedAt: null,
  },
  bows: [{ id: 'b1', model: 'Alpha', status: 'archived' }],
  sights: [],
  arrowSets: [],
  setups: [{ id: 's1', deletedAt: '2026-11-01T12:00:00Z' }],
  marks: [{ id: 'm1', distanceM: 30, scaleValueMm: 8 }],
};

function server(
  options: {
    requestedAt?: string;
    session?: unknown;
    exportHandler?: Handler;
    request?: Handler;
  } = {},
) {
  let requestedAt: string | null = options.requestedAt ?? null;
  let version = 1;
  const sent: Sent[] = [];
  const note = (request: Request) =>
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      ifMatch: request.headers.get('If-Match'),
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
  const profile = () => ({
    locale: 'es',
    unitSystem: 'metric',
    theme: 'system',
    quickAccess: null,
    deletionRequestedAt: requestedAt,
    purgeAt: requestedAt === null ? null : '2027-01-31T12:00:00Z',
    version,
  });
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(options.session ?? ANA),
    'GET /api/v1/me': () => json(profile()),
    'GET /api/v1/me/export': options.exportHandler ?? (() => json(EXPORT)),
    'POST /api/v1/me/deletion-request':
      options.request ??
      ((request) => {
        note(request);
        requestedAt = '2026-11-02T12:00:00Z';
        version += 1;
        return json(profile());
      }),
    'DELETE /api/v1/me/deletion-request': (request) => {
      note(request);
      requestedAt = null;
      version += 1;
      return json(profile());
    },
  });
  return { ...api, sent };
}

let blobs: Blob[] = [];
let clicked: { download: string; href: string }[] = [];

beforeEach(() => {
  blobs = [];
  clicked = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:test/${blobs.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ download: this.download, href: this.href });
  });
});
afterEach(() => vi.restoreAllMocks());

const open = (api = server()) => renderApp('/profile', api.fetch);

describe('Your account', () => {
  it('shows who is signed in and the version of the app', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Cuenta', level: 1 })).toBeVisible();
    const card = within(screen.getByRole('region', { name: 'Tu cuenta' }));
    expect(card.getByText('ana')).toBeInTheDocument();
    expect(card.getByText('ana@example.com')).toBeInTheDocument();
    expect(card.getByText('Versión de la app')).toBeInTheDocument();
  });
});

describe('Download my data (HU-ACC-05)', () => {
  it('saves everything the server sent as a JSON file named by its date', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'Descargar mis datos' }));

    expect(
      await screen.findByText('Listo: se descargó sight-mapper-2026-11-02.json.'),
    ).toBeVisible();
    expect(clicked).toEqual([{ download: 'sight-mapper-2026-11-02.json', href: 'blob:test/1' }]);
    const [blob] = blobs;
    expect(blob).toBeDefined();
    const saved = JSON.parse((await blob?.text()) ?? 'null') as typeof EXPORT;
    expect(saved).toEqual(EXPORT);
    expect(blob?.type).toBe('application/json');
  });

  it('says why when it cannot, and saves nothing', async () => {
    const user = userEvent.setup();
    open(
      server({
        exportHandler: () => errorEnvelope('SM-CORE-500-001', 'errors.core.unexpected', 500),
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Descargar mis datos' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(clicked).toEqual([]);
  });
});

describe('Ask for deletion (HU-ACC-06)', () => {
  it('explains why it is not immediate, and asks to confirm by typing the username', async () => {
    const user = userEvent.setup();
    const api = server();
    open(api);
    expect(await screen.findByText(/se eliminan a los 90 días/)).toBeVisible();
    expect(screen.getByText(/podés cancelar cuando quieras/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Pedir la baja' }));
    const dialog = within(await screen.findByRole('dialog'));
    const confirm = dialog.getByRole('button', { name: 'Sí, pedir la baja' });
    expect(confirm).toBeDisabled();

    await user.type(dialog.getByLabelText('Escribí ana para confirmar'), 'ann');
    expect(confirm).toBeDisabled();
    await user.type(dialog.getByLabelText('Escribí ana para confirmar'), 'a');
    // "anna" is not "ana": only the exact username opens the button.
    expect(confirm).toBeDisabled();
    await user.clear(dialog.getByLabelText('Escribí ana para confirmar'));
    await user.type(dialog.getByLabelText('Escribí ana para confirmar'), 'ana');
    expect(confirm).toBeEnabled();
    expect(api.sent).toEqual([]);
  });

  it('records it, and shows the date it will happen and a way to cancel', async () => {
    const user = userEvent.setup();
    const api = server();
    open(api);
    await user.click(await screen.findByRole('button', { name: 'Pedir la baja' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Escribí ana para confirmar'), 'ana');
    await user.click(dialog.getByRole('button', { name: 'Sí, pedir la baja' }));

    expect(await screen.findByText('Pediste la baja')).toBeVisible();
    expect(screen.getByText(/se eliminan el 31 ene 2027/)).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar la baja' })).toBeVisible();
    expect(api.sent).toHaveLength(1);
    expect(api.sent[0]).toMatchObject({ method: 'POST', path: '/api/v1/me/deletion-request' });
    expect(api.sent[0]?.idempotencyKey).toBeTruthy();
  });

  it('closes without asking when the archer changes their mind', async () => {
    const user = userEvent.setup();
    const api = server();
    open(api);
    await user.click(await screen.findByRole('button', { name: 'Pedir la baja' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.sent).toEqual([]);
  });

  it('opens already showing a deletion that was asked for before', async () => {
    open(server({ requestedAt: '2026-11-02T12:00:00Z' }));
    expect(await screen.findByText('Pediste la baja')).toBeVisible();
    expect(screen.getByText(/se eliminan el 31 ene 2027/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Pedir la baja' })).toBeNull();
  });

  it('says so when it was already asked for, with the date of the first request', async () => {
    const user = userEvent.setup();
    open(
      server({
        request: () =>
          json(
            {
              success: false,
              error: {
                code: 'SM-ACC-409-001',
                messageKey: 'errors.account.deletionAlreadyRequested',
                params: { purgeAt: '2027-01-31T12:00:00Z' },
                requestId: 'r',
                timestamp: '2026-11-02T12:00:00Z',
              },
            },
            409,
          ),
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Pedir la baja' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Escribí ana para confirmar'), 'ana');
    await user.click(dialog.getByRole('button', { name: 'Sí, pedir la baja' }));
    expect(
      await dialog.findByText(/Ya pediste la baja\. Se concreta el 31 ene 2027\./),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/\{\{/);
  });

  it('confirms with the email for an archer who has no username', async () => {
    const user = userEvent.setup();
    const noUsername = { ...ANA, user: { ...ANA.user, username: null } };
    open(server({ session: noUsername }));
    await user.click(await screen.findByRole('button', { name: 'Pedir la baja' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Escribí ana@example.com para confirmar')).toBeVisible();
  });
});

describe('Cancel the deletion', () => {
  it('withdraws it, with no version to match, and goes back to the start', async () => {
    const user = userEvent.setup();
    const api = server({ requestedAt: '2026-11-02T12:00:00Z' });
    open(api);
    await user.click(await screen.findByRole('button', { name: 'Cancelar la baja' }));

    expect(await screen.findByText('Listo: la baja quedó cancelada.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pedir la baja' })).toBeVisible();
    expect(screen.queryByText('Pediste la baja')).toBeNull();
    expect(api.sent).toHaveLength(1);
    expect(api.sent[0]).toMatchObject({ method: 'DELETE', ifMatch: null });
  });
});

describe('Loading', () => {
  it('says so and lets the archer retry when the account cannot be read', async () => {
    const api = fakeApi({
      'GET /api/auth/get-session': () => json(ANA),
      'GET /api/v1/me': () => errorEnvelope('SM-CORE-500-001', 'errors.core.unexpected', 500),
    });
    renderApp('/profile', api.fetch);
    await waitFor(() => expect(screen.getByText('No pudimos cargar tu cuenta')).toBeVisible(), {
      timeout: 8000,
    });
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });
});
