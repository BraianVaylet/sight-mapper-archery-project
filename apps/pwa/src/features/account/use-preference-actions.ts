import type { Locale, UnitSystem } from '@sight-mapper/types';
import { useQueryClient } from '@tanstack/react-query';
import { usePreferences, type ThemePreference } from '../../app/preferences.js';
import { sessionKey } from '../auth/session.js';
import { useUpdatePreferences } from './profile.js';

/**
 * Theme, language and units: the screen changes at once (the local store, which also serves the
 * pages before sign-in) and, when someone is signed in, the profile follows so the choice goes
 * with the archer to another device.
 */
export function usePreferenceActions() {
  const queryClient = useQueryClient();
  const update = useUpdatePreferences();
  const setTheme = usePreferences((state) => state.setTheme);
  const setLocale = usePreferences((state) => state.setLocale);

  /** Read when the archer acts, not while rendering: no request just to draw a footer. */
  const signedIn = () => queryClient.getQueryData(sessionKey) != null;

  return {
    update,
    theme(theme: ThemePreference) {
      setTheme(theme);
      if (signedIn()) update.mutate({ theme });
    },
    locale(locale: Locale) {
      setLocale(locale);
      if (signedIn()) update.mutate({ locale });
    },
    unitSystem(unitSystem: UnitSystem) {
      update.mutate({ unitSystem });
    },
  };
}
