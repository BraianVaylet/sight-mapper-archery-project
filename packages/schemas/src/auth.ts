import { z } from 'zod';

/** Same bounds the API enforces (`SM-AUTH-400-001`, `SM-AUTH-400-003`): the form says it first. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

const required = z.string().trim().min(1, { error: 'validation.required', abort: true });

const email = z
  .string()
  .trim()
  .min(1, { error: 'validation.required', abort: true })
  .pipe(z.email({ error: 'validation.auth.email' }));

const username = z
  .string()
  .trim()
  .min(1, { error: 'validation.required', abort: true })
  .regex(USERNAME_PATTERN, 'validation.auth.username');

/** A new password: length only, no composition rules (the product keeps them out of the way). */
const newPassword = z
  .string()
  .min(1, { error: 'validation.required', abort: true })
  .min(PASSWORD_MIN_LENGTH, 'validation.auth.passwordTooShort')
  .max(PASSWORD_MAX_LENGTH, 'validation.auth.passwordTooLong');

const passwordsMatch = <T extends { password: string; confirmPassword: string }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['confirmPassword'],
      message: 'validation.auth.passwordMismatch',
    });
  }
};

/** HU-ACC-01: email, username and two equal passwords. */
export const signUpForm = z
  .object({ email, username, password: newPassword, confirmPassword: z.string() })
  .superRefine(passwordsMatch);
export type SignUpForm = z.infer<typeof signUpForm>;

/** HU-ACC-02: an email or a username in one field; the server decides which it is. */
export const signInForm = z.object({
  identifier: required,
  password: z.string().min(1, { error: 'validation.required', abort: true }),
});
export type SignInForm = z.infer<typeof signInForm>;

export const emailForm = z.object({ email });
export type EmailForm = z.infer<typeof emailForm>;

/** HU-ACC-03: the new password, typed twice. */
export const resetPasswordForm = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .superRefine(passwordsMatch);
export type ResetPasswordForm = z.infer<typeof resetPasswordForm>;

/** A sign-in identifier that is an email goes to the email endpoint, anything else is a username. */
export const looksLikeEmail = (identifier: string): boolean => identifier.includes('@');
