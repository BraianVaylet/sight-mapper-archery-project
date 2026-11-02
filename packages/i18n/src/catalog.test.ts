import { readdirSync, readFileSync } from 'node:fs';
import { ERROR_CATALOG } from '@sight-mapper/types';
import { describe, expect, it } from 'vitest';
import { en } from './locales/en.js';
import { es } from './locales/es.js';

type Tree = { readonly [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key}`;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, `${path}.`)) out.set(k, v);
  }
  return out;
}

const spanish = flatten(es);
const english = flatten(en);
const placeholders = (message: string) =>
  [...message.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('ES / EN parity', () => {
  it('has the same keys in both languages', () => {
    expect([...english.keys()].sort()).toEqual([...spanish.keys()].sort());
  });

  it('has the same placeholders in every message', () => {
    for (const [key, message] of spanish) {
      expect(placeholders(english.get(key) ?? ''), key).toEqual(placeholders(message));
    }
  });

  // Names and symbols that do not translate: the product, each language written in itself, units.
  const SAME_IN_BOTH = new Set([
    'common.appName',
    'language.es',
    'language.en',
    'screens.doctor',
    'auth.email',
    'sandbox.table.meters',
    'sandbox.doctor.title',
    'sandbox.catalog.optionOne',
    'sandbox.catalog.imperial',
    // Archery terms the sport keeps in English in both languages.
    'bows.form.letOffPct',
    'bows.form.axleToAxleMm',
    'bows.form.braceHeightMm',
    'sights.form.pinMonopin',
    'sights.form.pinDualpin',
    'sights.form.pinMultipin',
    'sights.form.unitClick',
  ]);

  it('has no empty messages and no Spanish copied into English', () => {
    for (const [key, message] of english) {
      expect(message.trim().length, key).toBeGreaterThan(0);
      if (!SAME_IN_BOTH.has(key)) expect(message, key).not.toBe(spanish.get(key));
    }
  });

  it('uses the voseo of es-AR, not the tú of other regions', () => {
    const joined = [...spanish.values()].join(' ');
    expect(joined).not.toMatch(/\b(tienes|puedes|elige|revisa|verifica|inicia)\b/i);
  });
});

describe('error codes', () => {
  const keys = new Set<string>(Object.values(ERROR_CATALOG).map((e) => e.messageKey));

  it('every error code has its messageKey in both languages', () => {
    for (const key of keys) {
      expect(spanish.has(key), `es ${key}`).toBe(true);
      expect(english.has(key), `en ${key}`).toBe(true);
    }
  });

  it('has no orphan error message', () => {
    const orphans = [...spanish.keys()].filter((k) => k.startsWith('errors.') && !keys.has(k));
    expect(orphans).toEqual([]);
  });

  it('placeholders are display values for the params the API sends', () => {
    const wanted: Record<string, string[]> = {
      'errors.calc.needMarksInterpolate': ['have', 'need'],
      'errors.equipment.inUse': ['setups', 'marks'],
      'errors.core.rateLimited': ['retryAfterS'],
      'errors.auth.weakPassword': ['minLength'],
    };
    for (const [key, names] of Object.entries(wanted)) {
      expect(placeholders(spanish.get(key) ?? '')).toEqual([...names].sort());
    }
  });
});

describe('validation keys', () => {
  const schemasDir = new URL('../../schemas/src/', import.meta.url);
  const sources = readdirSync(schemasDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => readFileSync(new URL(f, schemasDir), 'utf8'))
    .join('\n');
  const used = [
    ...new Set([...sources.matchAll(/'(validation\.[\w.]+)'/g)].map((m) => m[1] ?? '')),
  ];

  it('finds the keys the schemas emit', () => {
    expect(used.length).toBeGreaterThanOrEqual(7);
  });

  it('translates every validation key a schema emits', () => {
    for (const key of used) {
      expect(spanish.has(key), `es ${key}`).toBe(true);
      expect(english.has(key), `en ${key}`).toBe(true);
    }
  });

  it('translates the Zod issue codes that toValidationIssues maps', () => {
    for (const code of [
      'custom',
      'invalid_type',
      'invalid_format',
      'invalid_value',
      'unrecognized_keys',
      'too_small',
      'too_big',
    ]) {
      expect(spanish.has(`validation.${code}`), code).toBe(true);
    }
  });
});
