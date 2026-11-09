import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseErrorsMarkdown, renderCatalog } from '../scripts/error-catalog.mjs';
import { ERROR_CATALOG } from './errors.generated.js';
import {
  ERROR_CODES,
  errorMessageKey,
  errorStatus,
  isErrorCode,
  type ErrorCode,
  type ErrorEnvelope,
} from './errors.js';

const errorsMd = readFileSync(new URL('../../../docs/errors.md', import.meta.url), 'utf8');

describe('error catalog', () => {
  it('is in sync with docs/errors.md (run `pnpm --filter @sight-mapper/types generate`)', () => {
    const generated = readFileSync(new URL('./errors.generated.ts', import.meta.url), 'utf8');
    expect(generated).toBe(renderCatalog(parseErrorsMarkdown(errorsMd)));
  });

  it('declares every documented code once, with a well-formed id', () => {
    expect(ERROR_CODES.length).toBeGreaterThan(40);
    for (const code of ERROR_CODES) expect(code).toMatch(/^SM-[A-Z]+-\d{3}-\d{3}$/);
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('derives the HTTP status from the code', () => {
    for (const code of ERROR_CODES) {
      expect(errorStatus(code)).toBe(Number(code.split('-')[2]));
    }
    expect(errorStatus('SM-MARK-409-001')).toBe(409);
    expect(errorStatus('SM-CORE-412-001')).toBe(412);
  });

  it('gives every code a messageKey under errors.*', () => {
    for (const code of ERROR_CODES) expect(errorMessageKey(code)).toMatch(/^errors\.[a-z]+\.\w+$/);
    expect(errorMessageKey('SM-MARK-409-001')).toBe('errors.mark.duplicateDistance');
  });

  it('keeps the documented params of a code', () => {
    expect(ERROR_CATALOG['SM-MARK-409-001'].params).toEqual(['existingMarkId', 'distanceM']);
    expect(ERROR_CATALOG['SM-CALC-422-001'].params).toEqual(['have', 'need']);
    expect(ERROR_CATALOG['SM-CORE-400-001'].params).toEqual(['issues']);
    expect(ERROR_CATALOG['SM-CORE-404-001'].params).toEqual([]);
    expect(ERROR_CATALOG['SM-NET-503-001'].params).toEqual([]);
  });

  it('shares one messageKey across the inUse codes of the three equipment modules', () => {
    const keys = ['SM-BOW-409-001', 'SM-SGT-409-001', 'SM-ARW-409-001'].map((c) =>
      errorMessageKey(c as ErrorCode),
    );
    expect(new Set(keys)).toEqual(new Set(['errors.equipment.inUse']));
  });

  it('knows which strings are codes', () => {
    expect(isErrorCode('SM-CORE-500-001')).toBe(true);
    expect(isErrorCode('SM-XXX-999-999')).toBe(false);
    expect(isErrorCode('toString')).toBe(false);
  });

  it('does not compile an undeclared code', () => {
    // @ts-expect-error SM-XXX-999-999 is not in docs/errors.md
    const undeclared: ErrorCode = 'SM-XXX-999-999';
    const declared: ErrorCode = 'SM-CORE-500-001';
    expect([undeclared, declared]).toHaveLength(2);
  });

  it('types the envelope with declared codes only', () => {
    const envelope: ErrorEnvelope = {
      success: false,
      error: {
        code: 'SM-CORE-404-002',
        messageKey: 'errors.core.notFound',
        params: { resource: 'bow' },
        requestId: '019a3c5e-0000-7000-8000-000000000000',
        timestamp: '2026-10-30T10:00:00.000Z',
      },
    };
    expect(envelope.error.code).toBe('SM-CORE-404-002');
  });
});

describe('parseErrorsMarkdown', () => {
  const table = (rows: string) =>
    `| Codigo | HTTP | messageKey | params | Cuando |\n| --- | --- | --- | --- | --- |\n${rows}`;

  it('reads code, status, key and params from a row', () => {
    const [entry] = parseErrorsMarkdown(
      table('| `SM-BOW-409-001` | 409 | `errors.equipment.inUse` | `setups`, `marks` | x |'),
    );
    expect(entry).toEqual({
      code: 'SM-BOW-409-001',
      module: 'BOW',
      status: 409,
      messageKey: 'errors.equipment.inUse',
      params: ['setups', 'marks'],
    });
  });

  it('reads params without the array marker or the example value', () => {
    const [entry] = parseErrorsMarkdown(
      table('| `SM-CALC-422-001` | 422 | `errors.calc.x` | `issues[]`, `need: 2`, `issues` | x |'),
    );
    expect(entry?.params).toEqual(['issues', 'need']);
  });

  it('handles tables without HTTP and params columns', () => {
    const md =
      '| Codigo | messageKey | Cuando |\n| --- | --- | --- |\n| `SM-NET-503-001` | `errors.net.offline` | x |';
    expect(parseErrorsMarkdown(md)[0]).toMatchObject({ status: 503, params: [] });
  });

  it('rejects a duplicate code', () => {
    const row = '| `SM-BOW-409-001` | 409 | `errors.a.b` | — | x |';
    expect(() => parseErrorsMarkdown(table(`${row}\n${row}`))).toThrow(/Duplicate/);
  });

  it('rejects an HTTP column that disagrees with the code', () => {
    expect(() =>
      parseErrorsMarkdown(table('| `SM-BOW-409-001` | 404 | `errors.a.b` | — | x |')),
    ).toThrow(/HTTP column/);
  });

  it('rejects a row without messageKey', () => {
    expect(() => parseErrorsMarkdown(table('| `SM-BOW-409-001` | 409 | nada | — | x |'))).toThrow(
      /messageKey/,
    );
  });

  it('rejects a document with no codes', () => {
    expect(() => parseErrorsMarkdown('# nada')).toThrow(/No error codes/);
  });
});
