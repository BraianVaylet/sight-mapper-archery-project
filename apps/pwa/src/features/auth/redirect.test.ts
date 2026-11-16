import { describe, expect, it } from 'vitest';
import { redirectSearch, safeRedirect, tokenSearch } from './redirect.js';

describe('safeRedirect', () => {
  it('keeps a path of this app, with its query', () => {
    expect(safeRedirect('/setups/abc?d=30')).toBe('/setups/abc?d=30');
    expect(safeRedirect('/')).toBe('/');
  });

  it.each([
    ['https://evil.test'],
    ['//evil.test'],
    [String.raw`/\evil.test`],
    ['evil'],
    ['javascript:alert(1)'],
    ['/ok\nnext'],
    [''],
  ])('falls back to home for %j', (value) => {
    expect(safeRedirect(value)).toBe('/');
  });

  it('falls back for anything that is not a string, and honours another fallback', () => {
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect(42)).toBe('/');
    expect(safeRedirect(null, '/home')).toBe('/home');
  });
});

describe('search schemas', () => {
  it('drops an invalid value instead of failing the route', () => {
    expect(redirectSearch.parse({ redirect: 5 })).toEqual({ redirect: undefined });
    expect(tokenSearch.parse({ token: 'x'.repeat(600) })).toEqual({ token: undefined });
    expect(tokenSearch.parse({ token: 'abc' })).toEqual({ token: 'abc' });
  });
});
