import { useHttp } from '@sight-mapper/client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { usePreferences } from '../../app/preferences.js';
import { profileQuery } from './profile.js';

/**
 * Once the profile arrives it is the truth for theme and language (ADR-004): the local store,
 * which only remembered the last choice on this device, takes its values. Renders nothing.
 */
export function ProfileSync() {
  const http = useHttp();
  const { data } = useQuery(profileQuery(http));
  const setTheme = usePreferences((state) => state.setTheme);
  const setLocale = usePreferences((state) => state.setLocale);

  useEffect(() => {
    if (data === undefined) return;
    setTheme(data.theme);
    setLocale(data.locale);
  }, [data, setTheme, setLocale]);

  return null;
}
