import { isApiError } from '@sight-mapper/client';
import { toValidationIssues } from '@sight-mapper/schemas';
import type { ValidationIssue } from '@sight-mapper/types';
import type { z } from 'zod';

/**
 * A TanStack Form validator over a shared Zod schema. Errors are `ValidationIssue`s (a message
 * key, never prose), so the field translates them in the archer's language at render time.
 */
export function validateWith<S extends z.ZodType>(schema: S, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  const fields: Record<string, ValidationIssue> = {};
  for (const issue of toValidationIssues(result.error)) {
    const name = String(issue.path[0] ?? '');
    // The first problem of a field is the one to fix first.
    if (name !== '' && fields[name] === undefined) fields[name] = issue;
  }
  return { fields };
}

const isIssue = (value: unknown): value is ValidationIssue =>
  typeof value === 'object' && value !== null && 'messageKey' in value;

/** The translated message of a field's first error, if any. */
export function fieldError(
  errors: readonly unknown[],
  translate: (key: string, params?: Record<string, string | number>) => string,
): string | undefined {
  const issue = errors.find(isIssue);
  if (issue === undefined) return undefined;
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(issue.params)) {
    if (typeof value === 'string' || typeof value === 'number') params[name] = value;
  }
  return translate(issue.messageKey, params);
}

/** Server errors that belong to one field of the sign-up form (HU-ACC-01). */
const FIELD_BY_CODE: Readonly<Record<string, string>> = {
  'SM-AUTH-409-001': 'email',
  'SM-AUTH-409-002': 'username',
  'SM-AUTH-400-001': 'password',
  'SM-AUTH-400-003': 'username',
};

/** The field a thrown error points at, or `undefined` when it is about the form as a whole. */
export function fieldOfError(error: unknown): string | undefined {
  return isApiError(error) ? FIELD_BY_CODE[error.code] : undefined;
}
