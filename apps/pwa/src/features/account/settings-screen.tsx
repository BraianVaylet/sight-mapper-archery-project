import { useHttp } from '@sight-mapper/client';
import { LOCALES, UNIT_SYSTEMS } from '@sight-mapper/types';
import { InfoAlert, SectionCard, Segmented, Skeleton } from '@sight-mapper/ui';
import { useQuery } from '@tanstack/react-query';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { THEMES, usePreferences } from '../../app/preferences.js';
import { profileQuery } from './profile.js';
import { usePreferenceActions } from './use-preference-actions.js';

/**
 * Settings (RF-ACC-04, UX-UI §4.5): the only place for theme, language and units. Each change shows
 * at once and is saved behind it (HU-ACC-04); the version of the app closes the screen.
 */
export function SettingsScreen({ version = __APP_VERSION__ }: { version?: string }) {
  const { t, translate } = useI18n();
  const http = useHttp();
  const profile = useQuery(profileQuery(http));
  const actions = usePreferenceActions();
  const theme = usePreferences((state) => state.theme);
  const locale = usePreferences((state) => state.locale);

  const failure = actions.update.error ?? profile.error;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-8">
      <h1 className="font-display text-3xl font-bold">{t('screens.settings')}</h1>
      <p className="font-ui text-base text-muted">{t('settings.intro')}</p>

      {failure === null ? null : (
        <InfoAlert variant="danger">{describeError(translate, failure).text}</InfoAlert>
      )}

      <SectionCard index="01" title={t('settings.display')}>
        <Segmented
          label={t('theme.label')}
          hint={t('settings.themeHint')}
          value={theme}
          onChange={actions.theme}
          options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
        />
      </SectionCard>

      <SectionCard index="02" title={t('settings.languageUnits')}>
        <Segmented
          label={t('language.label')}
          hint={t('settings.languageHint')}
          value={locale}
          onChange={actions.locale}
          options={LOCALES.map((value) => ({ value, label: t(`language.${value}`) }))}
        />
        {profile.data === undefined ? (
          <div aria-busy="true">
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <Segmented
            label={t('settings.units')}
            hint={t('settings.unitsHint')}
            value={profile.data.unitSystem}
            onChange={actions.unitSystem}
            options={UNIT_SYSTEMS.map((value) => ({ value, label: t(`settings.${value}`) }))}
          />
        )}
      </SectionCard>

      <SectionCard index="03" title={t('settings.about')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 font-ui text-base">
          <dt className="text-muted">{t('settings.version')}</dt>
          <dd className="font-mono tabular-nums">{version}</dd>
        </dl>
      </SectionCard>
    </section>
  );
}
