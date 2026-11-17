import { LanguageSwitch } from '@sight-mapper/ui';
import { LOCALES } from '@sight-mapper/types';
import type { ReactNode } from 'react';
import { usePreferenceActions } from '../features/account/use-preference-actions.js';
import { useI18n } from './i18n.js';
import { usePreferences } from './preferences.js';

/** The code on the button; the full name, in its own language, is the accessible name. */
const CODES = { es: 'ES', en: 'EN' } as const;

/**
 * Frame of the screens without a session (UX-UI §4.6): the language switch top right (there is no
 * Settings before signing in, RF-ACC-04) and the blueprint registration marks in two corners of the
 * viewport. The theme follows the system here.
 */
export function GuestFrame({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const locale = usePreferences((state) => state.locale);
  const actions = usePreferenceActions();

  return (
    <>
      <span aria-hidden="true" className="blueprint-reg blueprint-reg-start" />
      <span aria-hidden="true" className="blueprint-reg blueprint-reg-end" />
      <div className="flex justify-end pb-2">
        <LanguageSwitch
          label={t('language.label')}
          value={locale}
          onChange={actions.locale}
          options={LOCALES.map((value) => ({
            value,
            code: CODES[value],
            name: t(`language.${value}`),
          }))}
        />
      </div>
      {children}
    </>
  );
}
