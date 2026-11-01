import type { HttpClient } from '@sight-mapper/client';
import { looksLikeEmail, type SignInForm, type SignUpForm } from '@sight-mapper/schemas';

/**
 * Identity calls (Better Auth under `/api/auth`). Failures arrive as `ApiError` with an
 * `SM-AUTH-*` code: the screens translate the key, never the text.
 *
 * The verification and reset links in the emails open the API, which then sends the archer back
 * to these PWA addresses: `/verify-email` (with `?error=` if the link failed) and
 * `/reset-password` (with `?token=` or `?error=`).
 */
export const verifyCallback = (origin: string) => `${origin}/verify-email`;
export const resetRedirect = (origin: string) => `${origin}/reset-password`;

export const signIn = (http: HttpClient, { identifier, password }: SignInForm) =>
  looksLikeEmail(identifier)
    ? http.post('sign-in/email', { body: { email: identifier.trim(), password } })
    : http.post('sign-in/username', { body: { username: identifier.trim(), password } });

/** The username doubles as the display name: the product has no other. */
export const signUp = (http: HttpClient, form: SignUpForm, origin: string) =>
  http.post('sign-up/email', {
    body: {
      email: form.email,
      password: form.password,
      name: form.username,
      username: form.username,
      callbackURL: verifyCallback(origin),
    },
  });

export const resendVerification = (http: HttpClient, email: string, origin: string) =>
  http.post('send-verification-email', { body: { email, callbackURL: verifyCallback(origin) } });

export const requestPasswordReset = (http: HttpClient, email: string, origin: string) =>
  http.post('request-password-reset', { body: { email, redirectTo: resetRedirect(origin) } });

export const resetPassword = (http: HttpClient, token: string, newPassword: string) =>
  http.post('reset-password', { body: { token, newPassword } });

export const signOut = (http: HttpClient) => http.post('sign-out', { body: {} });
