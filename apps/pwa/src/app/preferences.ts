import { detectLocale } from '@sight-mapper/i18n';
import { LOCALES, type Locale } from '@sight-mapper/types';
import { create } from 'zustand';

export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEMES)[number];

const THEME_KEY = 'sm.theme';
const LOCALE_KEY = 'sm.locale';

/** Storage can be missing or throw (private window, blocked site data): never break the app. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The preference lasts for this session only.
  }
}

const isTheme = (value: string | null): value is ThemePreference =>
  THEMES.some((theme) => theme === value);
const isLocale = (value: string | null): value is Locale =>
  LOCALES.some((locale) => locale === value);

export function initialTheme(): ThemePreference {
  const stored = read(THEME_KEY);
  return isTheme(stored) ? stored : 'system';
}

export function initialLocale(): Locale {
  const stored = read(LOCALE_KEY);
  if (isLocale(stored)) return stored;
  return detectLocale(typeof navigator === 'undefined' ? [] : navigator.languages);
}

/** Applies the preference to the page: `system` removes the attribute so the media query decides. */
export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement) {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

type PreferencesState = {
  theme: ThemePreference;
  locale: Locale;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
};

/** Ephemeral UI state (ARQUITECTURA §5.1). Once there is a profile, it syncs from `profile.locale`. */
export const usePreferences = create<PreferencesState>((set) => ({
  theme: initialTheme(),
  locale: initialLocale(),
  setTheme: (theme) => {
    write(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  setLocale: (locale) => {
    write(LOCALE_KEY, locale);
    set({ locale });
  },
}));
