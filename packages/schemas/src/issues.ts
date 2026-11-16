import type { ValidationIssue } from '@sight-mapper/types';
import type { z } from 'zod';

const CUSTOM_KEY = /^validation\.[A-Za-z]+(\.[A-Za-z]+)*$/;

/**
 * Turns a Zod error into the `issues` of `SM-CORE-400-001` (errors.md §2): a path to mark the
 * field and a message key with params, never prose. Refinements and checks in this package already
 * carry a `validation.*` key as their message; Zod's own checks map to `validation.<code>` with
 * their limits as params.
 */
export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((segment) =>
      typeof segment === 'number' ? segment : String(segment),
    );
    if (CUSTOM_KEY.test(issue.message)) {
      return { path, messageKey: issue.message, params: {} };
    }
    return { path, messageKey: `validation.${issue.code}`, params: paramsOf(issue) };
  });
}

function paramsOf(issue: z.core.$ZodIssue): Record<string, unknown> {
  switch (issue.code) {
    case 'too_small':
      return {
        minimum: Number(issue.minimum),
        inclusive: issue.inclusive ?? true,
        origin: issue.origin,
      };
    case 'too_big':
      return {
        maximum: Number(issue.maximum),
        inclusive: issue.inclusive ?? true,
        origin: issue.origin,
      };
    case 'invalid_type':
      return { expected: issue.expected };
    case 'invalid_format':
      return { format: issue.format };
    case 'invalid_value':
      return { values: issue.values };
    case 'unrecognized_keys':
      return { keys: issue.keys };
    default:
      return {};
  }
}
