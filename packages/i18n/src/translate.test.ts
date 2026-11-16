import { describe, expect, it } from 'vitest';
import {
  catalogs,
  createTranslator,
  DEFAULT_LOCALE,
  hasKey,
  interpolate,
  translateKey,
} from './translate.js';

describe('createTranslator', () => {
  const es = createTranslator('es');
  const en = createTranslator('en');

  it('translates a plain key per locale', () => {
    expect(es('common.save')).toBe('Guardar');
    expect(en('common.save')).toBe('Save');
  });

  it('interpolates required params', () => {
    expect(es('errors.calc.needMarksInterpolate', { need: 2, have: 1 })).toBe(
      'Necesitás al menos 2 marcas para calcular (tenés 1).',
    );
    expect(en('errors.equipment.inUse', { setups: 3, marks: 12 })).toBe(
      "It's used in 3 setups and 12 marks. You can archive it instead.",
    );
  });

  it('does not compile an unknown key or missing params', () => {
    // @ts-expect-error no such key
    expect(es('no.existe')).toBe('no.existe');
    // @ts-expect-error the message needs { need, have }
    expect(es('errors.calc.needMarksInterpolate')).toContain('{{need}}');
    // @ts-expect-error `have` is missing
    expect(es('errors.calc.needMarksInterpolate', { need: 2 })).toContain('{{have}}');
    // @ts-expect-error this message takes no params
    expect(es('common.save', { x: 1 })).toBe('Guardar');
  });

  it('returns the key when a namespace (not a message) slips past the types', () => {
    // @ts-expect-error a namespace is not a message key
    expect(es('common')).toBe('common');
  });
});

describe('translateKey (API messageKey)', () => {
  it('translates a known key with params', () => {
    expect(translateKey('en', 'errors.core.rateLimited', { retryAfterS: 30 })).toBe(
      'Too many attempts. Try again in 30 s.',
    );
  });

  it('falls back to the generic error for an unknown key, never a raw key', () => {
    expect(translateKey('es', 'errors.future.thing')).toBe(
      'Algo salió mal de nuestro lado. Probá de nuevo.',
    );
    expect(translateKey('en', 'errors', {})).toBe(
      'Something went wrong on our side. Please try again.',
    );
  });

  it('accepts another fallback', () => {
    expect(translateKey('en', 'nope', undefined, 'common.back')).toBe('Back');
  });

  it('does not walk the prototype chain', () => {
    expect(translateKey('en', 'errors.__proto__.toString')).toBe(
      'Something went wrong on our side. Please try again.',
    );
    expect(hasKey('constructor')).toBe(false);
  });
});

describe('interpolate', () => {
  it('replaces every occurrence and keeps missing placeholders visible', () => {
    expect(interpolate('{{a}} + {{a}} = {{b}}', { a: 1 })).toBe('1 + 1 = {{b}}');
    expect(interpolate('plain')).toBe('plain');
    expect(interpolate('{{n}}', { n: 0 })).toBe('0');
  });
});

describe('catalogs', () => {
  it('has one catalog per locale and a default', () => {
    expect(Object.keys(catalogs).sort()).toEqual(['en', 'es']);
    expect(DEFAULT_LOCALE).toBe('es');
    expect(hasKey('common.save')).toBe(true);
    expect(hasKey('common.nope')).toBe(false);
  });
});
