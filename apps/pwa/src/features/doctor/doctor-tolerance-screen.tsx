import { useHttp } from '@sight-mapper/client';
import { decimalSeparator } from '@sight-mapper/i18n';
import { DOCTOR_TOLERANCE } from '@sight-mapper/schemas';
import { Button, InfoAlert, SectionCard, Select, Skeleton } from '@sight-mapper/ui';
import { useQuery } from '@tanstack/react-query';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { profileQuery, useUpdatePreferences } from '../account/profile.js';
import {
  effectiveTolerance,
  exampleThresholds,
  formatInches,
  formatMm,
  lowTolerance,
  toleranceOptions,
} from './doctor-tolerance.logic.js';

/**
 * The Doctor's own screen (RF-CAL-09, UX-UI §4.7): how the threshold is worked out, and the base
 * tolerance of the archer, global for every setup. A change shows at once and is saved behind it,
 * like Settings; "back to the default" stores `null`. The diagnosis itself stays in each setup.
 */
export function DoctorToleranceScreen() {
  const { t, locale, translate } = useI18n();
  const http = useHttp();
  const profile = useQuery(profileQuery(http));
  const update = useUpdatePreferences();
  const separator = decimalSeparator(locale);

  const stored = profile.data?.doctorToleranceMm ?? null;
  const tolerance = effectiveTolerance(stored);
  const example = exampleThresholds(tolerance);
  const mm = (value: number) => formatMm(value, separator);
  const failure = update.error ?? profile.error;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-8">
      <h1 className="font-display text-3xl font-bold">{t('screens.doctorTolerance')}</h1>
      <p className="font-ui text-base text-muted">{t('doctorTolerance.intro')}</p>

      {failure === null ? null : (
        <InfoAlert variant="danger">{describeError(translate, failure).text}</InfoAlert>
      )}

      <SectionCard index="01" title={t('doctorTolerance.howTitle')}>
        <ul className="flex list-disc flex-col gap-2 pl-5 font-ui text-base">
          <li>{t('doctorTolerance.how1')}</li>
          <li>{t('doctorTolerance.how2')}</li>
          <li>{t('doctorTolerance.how3')}</li>
          <li>{t('doctorTolerance.how4')}</li>
        </ul>
        <p className="rounded-sm border-2 border-dotted border-line p-3 font-mono text-sm">
          {t('doctorTolerance.example', {
            tolerance: mm(tolerance),
            inner: mm(example.inner),
            ends: mm(example.ends),
          })}
        </p>
      </SectionCard>

      <SectionCard index="02" title={t('doctorTolerance.toleranceTitle')}>
        {profile.data === undefined ? (
          <div aria-busy="true">
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <Select
              label={t('doctorTolerance.label')}
              hint={[
                t('doctorTolerance.hint'),
                profile.data.units.sight === 'imperial'
                  ? t('doctorTolerance.inches', { inches: formatInches(tolerance, separator) })
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              value={String(tolerance)}
              onChange={(event) => {
                const value = Number(event.target.value);
                // The default is stored as `null`, so a later recalibration reaches this archer.
                update.mutate({
                  doctorToleranceMm: value === DOCTOR_TOLERANCE.defaultMm ? null : value,
                });
              }}
              options={toleranceOptions().map((value) => ({
                value: String(value),
                label: t(
                  value === DOCTOR_TOLERANCE.defaultMm
                    ? 'doctorTolerance.optionDefault'
                    : 'doctorTolerance.option',
                  { value: mm(value) },
                ),
              }))}
            />
            {lowTolerance(tolerance) ? (
              <InfoAlert variant="warning">{t('doctorTolerance.lowWarning')}</InfoAlert>
            ) : null}
            <Button
              variant="secondary"
              disabled={stored === null}
              onClick={() => update.mutate({ doctorToleranceMm: null })}
            >
              {t('doctorTolerance.reset')}
            </Button>
          </>
        )}
      </SectionCard>
    </section>
  );
}
