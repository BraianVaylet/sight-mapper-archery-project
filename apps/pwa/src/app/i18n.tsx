import { createTranslator, translateKey, type Params } from '@sight-mapper/i18n';
import type { Locale } from '@sight-mapper/types';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePreferences } from './preferences.js';

type I18n = {
  locale: Locale;
  t: ReturnType<typeof createTranslator>;
  /** For a key that arrives as a string, like an API `messageKey`. */
  translate: (key: string, params?: Params) => string;
};

const I18nContext = createContext<I18n | null>(null);

/** Typed `t('key')` over the shared catalogs; also keeps `<html lang>` in step with the locale. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = usePreferences((state) => state.locale);
  const value = useMemo<I18n>(
    () => ({
      locale,
      t: createTranslator(locale),
      translate: (key, params) => translateKey(locale, key, params),
    }),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) throw new Error('useI18n needs an <I18nProvider> above it');
  return value;
}
