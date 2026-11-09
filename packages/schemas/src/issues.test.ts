import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ID } from '../test/fixtures.js';
import { createBow, sightScale } from './equipment.js';
import { toValidationIssues } from './issues.js';
import { createMark } from './calculator.js';

const issuesOf = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected a validation failure');
  return toValidationIssues(result.error);
};

describe('toValidationIssues', () => {
  it('keeps the validation.* key of our refinements and the path of the field', () => {
    const issues = issuesOf(sightScale, { unit: 'custom', min: 5, max: 5, resolution: 1 });
    expect(issues).toEqual([
      { path: ['max'], messageKey: 'validation.scale.minLessThanMax', params: {} },
    ]);
  });

  it('maps a range violation to its limits', () => {
    const [issue] = issuesOf(createBow, {
      id: ID.a,
      bowType: 'compound',
      model: 'X',
      letOffPct: 120,
    });
    expect(issue).toEqual({
      path: ['letOffPct'],
      messageKey: 'validation.too_big',
      params: { maximum: 99, inclusive: true, origin: 'number' },
    });
  });

  it('maps a lower bound', () => {
    const [issue] = issuesOf(createBow, {
      id: ID.a,
      bowType: 'compound',
      model: 'X',
      letOffPct: -1,
    });
    expect(issue).toMatchObject({
      messageKey: 'validation.too_small',
      params: { minimum: 0, inclusive: true, origin: 'number' },
    });
  });

  it('maps a wrong type and a missing field', () => {
    const issues = issuesOf(createMark, {
      id: ID.a,
      setupId: ID.a,
      arrowSetId: ID.b,
      distanceM: '40',
    });
    const byPath = Object.fromEntries(issues.map((i) => [i.path.join('.'), i]));
    expect(byPath['distanceM']).toMatchObject({
      messageKey: 'validation.invalid_type',
      params: { expected: 'number' },
    });
    expect(byPath['scaleValueMm']).toMatchObject({ messageKey: 'validation.invalid_type' });
  });

  it('maps a bad format and an unknown enum value', () => {
    const format = issuesOf(z.object({ id: z.uuidv7() }), { id: 'nope' })[0];
    expect(format).toMatchObject({ path: ['id'], messageKey: 'validation.invalid_format' });
    expect(format?.params).toMatchObject({ format: 'uuid' });

    const value = issuesOf(z.object({ kind: z.enum(['a', 'b']) }), { kind: 'c' })[0];
    expect(value).toMatchObject({
      messageKey: 'validation.invalid_value',
      params: { values: ['a', 'b'] },
    });
  });

  it('maps unrecognized keys', () => {
    const [issue] = issuesOf(z.strictObject({ a: z.string() }), { a: 'x', b: 1 });
    expect(issue).toMatchObject({
      path: [],
      messageKey: 'validation.unrecognized_keys',
      params: { keys: ['b'] },
    });
  });

  it('keeps array indexes as numbers', () => {
    const [issue] = issuesOf(z.object({ ids: z.array(z.uuidv7()) }), { ids: [ID.a, 'x'] });
    expect(issue?.path).toEqual(['ids', 1]);
  });

  it('does not trust free text from a custom check', () => {
    const [issue] = issuesOf(
      z.string().refine(() => false, 'some prose'),
      'x',
    );
    expect(issue).toEqual({ path: [], messageKey: 'validation.custom', params: {} });
  });

  it('reports every issue, not just the first', () => {
    const issues = issuesOf(createBow, { id: 'x', bowType: 'longbow' });
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
