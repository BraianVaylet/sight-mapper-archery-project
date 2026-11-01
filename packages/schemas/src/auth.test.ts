import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import {
  emailForm,
  looksLikeEmail,
  resetPasswordForm,
  signInForm,
  signUpForm,
  USERNAME_PATTERN,
} from './auth.js';
import { toValidationIssues } from './issues.js';

const valid = {
  email: 'ana@example.com',
  username: 'ana.k_1',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
};

const keysOf = (result: { success: boolean; error?: ZodError }) =>
  result.error === undefined
    ? []
    : toValidationIssues(result.error).map((i) => [i.path.join('.'), i.messageKey]);

describe('signUpForm', () => {
  it('accepts an email, a username and two equal passwords', () => {
    expect(signUpForm.safeParse(valid).success).toBe(true);
  });

  it('trims the email and the username', () => {
    const parsed = signUpForm.parse({ ...valid, email: '  ana@example.com ', username: ' ana ' });
    expect(parsed.email).toBe('ana@example.com');
    expect(parsed.username).toBe('ana');
  });

  it('marks the second password field when they differ (HU-ACC-01)', () => {
    expect(keysOf(signUpForm.safeParse({ ...valid, confirmPassword: 'other-password' }))).toEqual([
      ['confirmPassword', 'validation.auth.passwordMismatch'],
    ]);
  });

  it('asks for every empty field with the same message', () => {
    const empty = signUpForm.safeParse({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    });
    expect(keysOf(empty)).toEqual([
      ['email', 'validation.required'],
      ['username', 'validation.required'],
      ['password', 'validation.required'],
    ]);
  });

  it.each([['ana'], ['not-an-email'], ['a@b']])('rejects the email %j', (email) => {
    expect(keysOf(signUpForm.safeParse({ ...valid, email }))).toEqual([
      ['email', 'validation.auth.email'],
    ]);
  });

  it.each([['ab'], ['Ana'], ['ana k'], ['ana-k'], ['x'.repeat(31)], ['ñandú']])(
    'rejects the username %j with the pattern the API enforces',
    (username) => {
      expect(keysOf(signUpForm.safeParse({ ...valid, username }))).toEqual([
        ['username', 'validation.auth.username'],
      ]);
      expect(USERNAME_PATTERN.test(username)).toBe(false);
    },
  );

  it('rejects a password under 8 characters and one over 128', () => {
    expect(
      keysOf(signUpForm.safeParse({ ...valid, password: 'short', confirmPassword: 'short' })),
    ).toEqual([['password', 'validation.auth.passwordTooShort']]);
    const long = 'x'.repeat(129);
    expect(
      keysOf(signUpForm.safeParse({ ...valid, password: long, confirmPassword: long })),
    ).toEqual([['password', 'validation.auth.passwordTooLong']]);
  });

  it('does not trim a password: spaces are part of it', () => {
    const spaced = '  eight sp  ';
    expect(signUpForm.parse({ ...valid, password: spaced, confirmPassword: spaced }).password).toBe(
      spaced,
    );
  });
});

describe('signInForm', () => {
  it('takes an email or a username, and a password', () => {
    expect(signInForm.safeParse({ identifier: 'ana', password: 'x' }).success).toBe(true);
    expect(signInForm.safeParse({ identifier: 'ana@example.com', password: 'x' }).success).toBe(
      true,
    );
  });

  it('requires both, without judging the password (the server does)', () => {
    expect(keysOf(signInForm.safeParse({ identifier: ' ', password: '' }))).toEqual([
      ['identifier', 'validation.required'],
      ['password', 'validation.required'],
    ]);
  });
});

describe('emailForm and resetPasswordForm', () => {
  it('validate an email', () => {
    expect(emailForm.safeParse({ email: 'ana@example.com' }).success).toBe(true);
    expect(keysOf(emailForm.safeParse({ email: 'nope' }))).toEqual([
      ['email', 'validation.auth.email'],
    ]);
  });

  it('reset needs a valid new password typed twice', () => {
    expect(
      resetPasswordForm.safeParse({ password: 'brand-new-pass', confirmPassword: 'brand-new-pass' })
        .success,
    ).toBe(true);
    expect(
      keysOf(resetPasswordForm.safeParse({ password: 'brand-new-pass', confirmPassword: 'x' })),
    ).toEqual([['confirmPassword', 'validation.auth.passwordMismatch']]);
  });
});

describe('looksLikeEmail', () => {
  it('sends an @ to the email endpoint and anything else to the username one', () => {
    expect(looksLikeEmail('ana@example.com')).toBe(true);
    expect(looksLikeEmail('ana.k_1')).toBe(false);
  });
});
