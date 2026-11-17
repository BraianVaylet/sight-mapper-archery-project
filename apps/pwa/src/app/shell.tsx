import type { ReactNode } from 'react';
import { useI18n } from './i18n.js';

/**
 * Frame of every screen: skip link and one `main` landmark over the blueprint paper. No footer:
 * theme, language and units live only in Settings (RF-ACC-04), the version too.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        {t('app.skipToContent')}
      </a>
      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 p-4">
        {children}
      </main>
    </div>
  );
}
