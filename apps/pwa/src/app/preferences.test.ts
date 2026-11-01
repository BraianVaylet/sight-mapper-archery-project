import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initialLocale, initialTheme, usePreferences } from './preferences.js';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('theme', () => {
  it('forces dark or light with the data-theme attribute and lets the system decide otherwise', () => {
    const root = document.createElement('div');
    applyTheme('dark', root);
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyTheme('light', root);
    expect(root.getAttribute('data-theme')).toBe('light');
    applyTheme('system', root);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('remembers the choice and applies it at once', () => {
    usePreferences.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('sm.theme')).toBe('light');
    expect(initialTheme()).toBe('light');
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem('sm.theme', 'neon');
    expect(initialTheme()).toBe('system');
  });
});

describe('locale', () => {
  it('uses what the archer chose over the browser language', () => {
    usePreferences.getState().setLocale('en');
    expect(initialLocale()).toBe('en');
  });

  it('falls back to the browser language, then to Spanish', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    expect(initialLocale()).toBe('en');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    expect(initialLocale()).toBe('es');
  });
});

describe('when storage is unavailable', () => {
  it('still works for the session instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(initialTheme()).toBe('system');
    usePreferences.getState().setTheme('dark');
    expect(usePreferences.getState().theme).toBe('dark');
  });
});
