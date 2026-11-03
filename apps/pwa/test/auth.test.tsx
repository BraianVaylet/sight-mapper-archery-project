import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { usePreferences } from '../src/app/preferences.js';
import { ANA, errorEnvelope, fakeApi, json } from './fake-api.js';
import { renderApp } from './render-app.js';

const PASSWORD = 'correct-horse-battery';

/** Fills a labelled field the way an archer would: click, type. */
const type = async (label: string, text: string) => {
  await userEvent.type(screen.getByLabelText(label), text);
};

const bodyOf = async (request: Request) => (await request.json()) as Record<string, unknown>;

/** A server whose session starts empty and appears once `sign-in` succeeded. */
function sessionServer(
  extra: Record<string, (request: Request) => Response | Promise<Response>> = {},
) {
  let signedIn = false;
  const sent: Record<string, unknown>[] = [];
  const api = fakeApi({
    'GET /api/auth/get-session': () => json(signedIn ? ANA : null),
    'POST /api/auth/sign-in/email': async (request) => {
      sent.push({ endpoint: 'email', ...(await bodyOf(request)) });
      signedIn = true;
      return json({ token: 't', user: ANA.user });
    },
    'POST /api/auth/sign-in/username': async (request) => {
      sent.push({ endpoint: 'username', ...(await bodyOf(request)) });
      signedIn = true;
      return json({ token: 't', user: ANA.user });
    },
    ...extra,
  });
  return { ...api, sent };
}

describe('sign-in', () => {
  it('asks for both fields before sending anything', async () => {
    const api = sessionServer();
    renderApp('/sign-in', api.fetch);
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));

    expect(await screen.findAllByText('Completá este campo.')).toHaveLength(2);
    expect(api.calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  });

  it('signs in with an email and lands on the home', async () => {
    const api = sessionServer();
    const { app } = renderApp('/sign-in', api.fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await type('Email o usuario', 'ana@example.com');
    await type('Contraseña', PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Tus setups' })).toBeInTheDocument();
    expect(app.router.state.location.pathname).toBe('/');
    expect(api.sent).toEqual([{ endpoint: 'email', email: 'ana@example.com', password: PASSWORD }]);
  });

  it('signs in with a username through the username endpoint', async () => {
    const api = sessionServer();
    renderApp('/sign-in', api.fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await type('Email o usuario', 'ana');
    await type('Contraseña', PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await screen.findByRole('heading', { name: 'Tus setups' });
    expect(api.sent).toEqual([{ endpoint: 'username', username: 'ana', password: PASSWORD }]);
  });

  it('goes back to where the archer was heading', async () => {
    const api = sessionServer();
    const { app } = renderApp('/setups/abc/print', api.fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await type('Email o usuario', 'ana');
    await type('Contraseña', PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Listado imprimible' })).toBeInTheDocument();
    expect(app.router.state.location.pathname).toBe('/setups/abc/print');
  });

  it('does not say which of the two was wrong', async () => {
    const api = sessionServer({
      'POST /api/auth/sign-in/username': () =>
        errorEnvelope('SM-AUTH-401-001', 'errors.auth.invalidCredentials', 401),
    });
    renderApp('/sign-in', api.fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await type('Email o usuario', 'ana');
    await type('Contraseña', 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
    // A wrong password is a 401 too, but it is not an expired session: no redirect, still here.
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('offers to resend the verification when the email is not verified', async () => {
    const api = sessionServer({
      'POST /api/auth/sign-in/username': () =>
        errorEnvelope('SM-AUTH-403-001', 'errors.auth.emailNotVerified', 403),
    });
    renderApp('/sign-in', api.fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await type('Email o usuario', 'ana');
    await type('Contraseña', PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Verificá tu email para iniciar sesión.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reenviar verificación' })).toHaveAttribute(
      'href',
      '/verify-email',
    );
  });

  it('shows how long to wait when the rate limit is hit', async () => {
    const api = sessionServer({
      'POST /api/auth/sign-in/username': () =>
        json(
          {
            success: false,
            error: {
              code: 'SM-CORE-429-001',
              messageKey: 'errors.core.rateLimited',
              params: { retryAfterS: 840 },
              requestId: 'req-429',
              timestamp: '2026-11-01T12:00:00Z',
            },
          },
          429,
        ),
    });
    renderApp('/sign-in', api.fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await type('Email o usuario', 'ana');
    await type('Contraseña', 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Demasiados intentos. Probá de nuevo en 840 s.'),
    ).toBeInTheDocument();
    expect(screen.getByText('req-429')).toBeInTheDocument();
  });

  it('reveals the password only on request', async () => {
    renderApp('/sign-in', sessionServer().fetch);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    const password = screen.getByLabelText('Contraseña');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('speaks English with the same flow', async () => {
    usePreferences.setState({ locale: 'en' });
    renderApp('/sign-in', sessionServer().fetch);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('Fill in this field.')).toHaveLength(2);
  });
});

describe('sign-up', () => {
  const fill = async (overrides: Partial<Record<string, string>> = {}) => {
    await type('Email', overrides['email'] ?? 'ana@example.com');
    await type('Usuario', overrides['username'] ?? 'ana');
    await type('Contraseña', overrides['password'] ?? PASSWORD);
    await type('Repetí la contraseña', overrides['confirm'] ?? PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  };

  it('blocks different passwords on the second field, without calling the server', async () => {
    const api = sessionServer();
    renderApp('/sign-up', api.fetch);
    await screen.findByRole('heading', { name: 'Crear cuenta' });
    await fill({ confirm: 'something-else' });

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(screen.getByLabelText('Repetí la contraseña')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  });

  it('says what is wrong with each field at once', async () => {
    renderApp('/sign-up', sessionServer().fetch);
    await screen.findByRole('heading', { name: 'Crear cuenta' });
    await fill({ email: 'nope', username: 'Ana K', password: 'short', confirm: 'short' });

    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(
      screen.getByText('Usá de 3 a 30 caracteres: minúsculas, números, punto o guion bajo.', {
        selector: '[id$="-error"]',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Usá al menos 8 caracteres.', { selector: '[id$="-error"]' }),
    ).toBeInTheDocument();
  });

  it('creates the account and asks the archer to check the email', async () => {
    const sent: Record<string, unknown>[] = [];
    const api = sessionServer({
      'POST /api/auth/sign-up/email': async (request) => {
        sent.push(await bodyOf(request));
        return json({ token: null, user: ANA.user });
      },
    });
    renderApp('/sign-up', api.fetch);
    await screen.findByRole('heading', { name: 'Crear cuenta' });
    await fill();

    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeInTheDocument();
    expect(screen.getByText(/ana@example\.com/)).toBeInTheDocument();
    expect(sent).toEqual([
      {
        email: 'ana@example.com',
        password: PASSWORD,
        name: 'ana',
        username: 'ana',
        callbackURL: `${window.location.origin}/verify-email`,
      },
    ]);
  });

  it('shows an email that is taken on the email field (SM-AUTH-409-001)', async () => {
    const api = sessionServer({
      'POST /api/auth/sign-up/email': () =>
        errorEnvelope('SM-AUTH-409-001', 'errors.auth.emailTaken', 409),
    });
    renderApp('/sign-up', api.fetch);
    await screen.findByRole('heading', { name: 'Crear cuenta' });
    await fill();

    const message = await screen.findByText('Ese email ya está registrado.');
    expect(message).toHaveAttribute('id', expect.stringMatching(/-error$/));
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a username that is taken on the username field (SM-AUTH-409-002)', async () => {
    const api = sessionServer({
      'POST /api/auth/sign-up/email': () =>
        errorEnvelope('SM-AUTH-409-002', 'errors.auth.usernameTaken', 409),
    });
    renderApp('/sign-up', api.fetch);
    await screen.findByRole('heading', { name: 'Crear cuenta' });
    await fill();

    await screen.findByText('Ese usuario ya está en uso.');
    expect(screen.getByLabelText('Usuario')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('shows any other failure as a message for the whole form', async () => {
    const api = sessionServer({
      'POST /api/auth/sign-up/email': () =>
        errorEnvelope('SM-CORE-500-001', 'errors.core.unexpected', 500),
    });
    renderApp('/sign-up', api.fetch);
    await screen.findByRole('heading', { name: 'Crear cuenta' });
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal de nuestro lado.');
  });
});

describe('forgot password', () => {
  it('gives the same answer for any email (HU-ACC-03)', async () => {
    const sent: Record<string, unknown>[] = [];
    const api = sessionServer({
      'POST /api/auth/request-password-reset': async (request) => {
        sent.push(await bodyOf(request));
        return json({ status: true });
      },
    });
    renderApp('/forgot-password', api.fetch);
    await screen.findByRole('heading', { name: 'Recuperar contraseña' });
    await type('Email', 'who@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(
      await screen.findByText('Si el email existe, te enviamos un enlace. Vence en 1 hora.'),
    ).toBeInTheDocument();
    expect(sent).toEqual([
      { email: 'who@example.com', redirectTo: `${window.location.origin}/reset-password` },
    ]);
  });

  it('rejects something that is not an email', async () => {
    const api = sessionServer();
    renderApp('/forgot-password', api.fetch);
    await screen.findByRole('heading', { name: 'Recuperar contraseña' });
    await type('Email', 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  });
});

describe('reset password', () => {
  it('sets the new password with the token of the link', async () => {
    const sent: Record<string, unknown>[] = [];
    const api = sessionServer({
      'POST /api/auth/reset-password': async (request) => {
        sent.push(await bodyOf(request));
        return json({ status: true });
      },
    });
    renderApp('/reset-password?token=tok-123', api.fetch);
    await screen.findByRole('heading', { name: 'Nueva contraseña' });
    await type('Contraseña', 'brand-new-password');
    await type('Repetí la contraseña', 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(
      await screen.findByText('Listo: tu contraseña cambió. Iniciá sesión con la nueva.'),
    ).toBeInTheDocument();
    expect(sent).toEqual([{ token: 'tok-123', newPassword: 'brand-new-password' }]);
  });

  it.each([['/reset-password'], ['/reset-password?error=INVALID_TOKEN']])(
    'offers another link when %s has no usable token',
    async (path) => {
      renderApp(path, sessionServer().fetch);
      expect(await screen.findByText('El enlace no es válido o ya venció.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Pedir otro enlace' })).toHaveAttribute(
        'href',
        '/forgot-password',
      );
      expect(screen.queryByRole('button', { name: 'Guardar contraseña' })).toBeNull();
    },
  );

  it('offers another link when the server says the token is dead (SM-AUTH-400-002)', async () => {
    const api = sessionServer({
      'POST /api/auth/reset-password': () =>
        errorEnvelope('SM-AUTH-400-002', 'errors.auth.invalidOrExpiredToken', 400),
    });
    renderApp('/reset-password?token=old', api.fetch);
    await screen.findByRole('heading', { name: 'Nueva contraseña' });
    await type('Contraseña', 'brand-new-password');
    await type('Repetí la contraseña', 'brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(await screen.findByRole('link', { name: 'Pedir otro enlace' })).toBeInTheDocument();
  });

  it('checks the two passwords before asking the server', async () => {
    const api = sessionServer();
    renderApp('/reset-password?token=tok', api.fetch);
    await screen.findByRole('heading', { name: 'Nueva contraseña' });
    await type('Contraseña', 'brand-new-password');
    await type('Repetí la contraseña', 'different-one');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  });
});

describe('verify email', () => {
  it('confirms the account when the link signed the archer in', async () => {
    renderApp('/verify-email', fakeApi({ 'GET /api/auth/get-session': () => json(ANA) }).fetch);
    expect(await screen.findByRole('heading', { name: 'Email verificado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
  });

  it('keeps waiting, with a way to ask again, while there is no session', async () => {
    renderApp('/verify-email', sessionServer().fetch);
    expect(await screen.findByText(/Abrí el enlace que te enviamos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar verificación' })).toBeInTheDocument();
  });

  it('says the link failed and resends without revealing whether the email exists', async () => {
    const sent: Record<string, unknown>[] = [];
    const api = sessionServer({
      'POST /api/auth/send-verification-email': async (request) => {
        sent.push(await bodyOf(request));
        return json({ status: true });
      },
    });
    renderApp('/verify-email?error=INVALID_TOKEN', api.fetch);
    expect(await screen.findByText('El enlace no es válido o ya venció.')).toBeInTheDocument();
    await type('Email', 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar verificación' }));

    await waitFor(() =>
      expect(
        screen.getByText('Si el email existe y falta verificarlo, te enviamos otro enlace.'),
      ).toBeInTheDocument(),
    );
    expect(sent).toEqual([
      { email: 'ana@example.com', callbackURL: `${window.location.origin}/verify-email` },
    ]);
    // A failed link never asks who is signed in.
    expect(api.calls).not.toContain('GET /api/auth/get-session');
  });
});
