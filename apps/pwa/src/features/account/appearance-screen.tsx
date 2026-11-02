import { useHttp } from '@sight-mapper/client';
import { LOCALES, UNIT_SYSTEMS } from '@sight-mapper/types';
import { InfoAlert, SectionCard, Segmented, Skeleton } from '@sight-mapper/ui';
import { useQuery } from '@tanstack/react-query';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { THEMES, usePreferences } from '../../app/preferences.js';
import { profileQuery } from './profile.js';
import { usePreferenceActions } from './use-preference-actions.js';

/** Theme, language and units (HU-ACC-04): each change shows at once and is saved behind it. */
export function AppearanceScreen() {
  const { t, translate } = useI18n();
  const http = useHttp();
  const profile = useQuery(profileQuery(http));
  const actions = usePreferenceActions();
  const theme = usePreferences((state) => state.theme);
  const locale = usePreferences((state) => state.locale);

  const failure = actions.update.error ?? profile.error;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">{t('screens.appearance')}</h1>
      <p className="font-ui text-base text-muted">{t('appearance.intro')}</p>

      {failure === null ? null : (
        <InfoAlert variant="danger">{describeError(translate, failure).text}</InfoAlert>
      )}

      <SectionCard title={t('appearance.group')}>
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
        {profile.data === undefined ? (
          <div aria-busy="true">
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <Segmented
            label={t('appearance.units')}
            value={profile.data.unitSystem}
            onChange={actions.unitSystem}
            options={UNIT_SYSTEMS.map((value) => ({ value, label: t(`appearance.${value}`) }))}
          />
        )}
      </SectionCard>
    </section>
  );
}
