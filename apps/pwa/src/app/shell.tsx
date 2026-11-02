import { Segmented } from '@sight-mapper/ui';
import { LOCALES } from '@sight-mapper/types';
import type { ReactNode } from 'react';
import { useI18n } from './i18n.js';
import { usePreferenceActions } from '../features/account/use-preference-actions.js';
import { THEMES, usePreferences } from './preferences.js';

/** Theme, language and version: always reachable, also before signing in. */
export function PreferencesBar() {
  const { t } = useI18n();
  const theme = usePreferences((state) => state.theme);
  const locale = usePreferences((state) => state.locale);
  const actions = usePreferenceActions();

  return (
    <div className="flex flex-wrap items-end justify-center gap-4 p-4">
      <Segmented
        label={t('theme.label')}
        value={theme}
        onChange={actions.theme}
        options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
      />
      <Segmented
        label={t('language.label')}
        value={locale}
        onChange={actions.locale}
        options={LOCALES.map((value) => ({ value, label: t(`language.${value}`) }))}
      />
    </div>
  );
}

export function AppFooter({ version = __APP_VERSION__ }: { version?: string }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border text-center">
      <PreferencesBar />
      <p className="pb-4 font-ui text-sm text-muted">{t('app.version', { version })}</p>
    </footer>
  );
}

/** Frame of every screen: skip link, one `main` landmark, footer. */
export function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        {t('app.skipToContent')}
      </a>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 p-4">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
