import {
  CALC_MIN_MARKS_DOCTOR,
  CALC_MIN_MARKS_INTERPOLATE,
  decimalsForQuantum,
  formatReading,
} from '@sight-mapper/domain';
import { formatNumber } from '@sight-mapper/i18n';
import type { SetupView } from '@sight-mapper/schemas';
import {
  ErrorState,
  InfoAlert,
  SectionCard,
  Select,
  Skeleton,
  StatusBadge,
} from '@sight-mapper/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useI18n } from '../../app/i18n.js';
import { componentName } from '../equipment/names.js';
import { useSetupName } from '../setups/home-screen.js';
import { Ruler, type RulerMark } from '../sight/ruler.js';
import { useSightData } from '../sight/sight-data.js';
import { formatDistance } from '../sight/sight.logic.js';
import { WithSetup } from '../sight/with-setup.js';
import { doctorView, type DoctorRowState } from './doctor.logic.js';
import { describeError } from '../../app/errors.js';

export type DoctorScreenProps = {
  setupId: string;
  /** From the URL (`?arrowSet=`). */
  arrowSetId: string | undefined;
};

export function DoctorScreen({ setupId, arrowSetId }: DoctorScreenProps) {
  return (
    <WithSetup setupId={setupId}>
      {(setup) => <DoctorView setup={setup} arrowSetId={arrowSetId} />}
    </WithSetup>
  );
}

function DoctorView({ setup, arrowSetId }: { setup: SetupView; arrowSetId: string | undefined }) {
  const { t, locale, translate } = useI18n();
  const navigate = useNavigate();
  const nameOf = useSetupName();
  const { system, separator, arrowId, marksQuery, marks, scale, analysis } = useSightData(
    setup,
    arrowSetId,
  );
  const view = doctorView(marks, analysis, scale);

  const unit = t(system === 'metric' ? 'sight.distanceUnitMetric' : 'sight.distanceUnitImperial');
  const showDistance = (m: number) => formatDistance(m, system, locale, unit);
  const scaleUnit = t(`doctor.unit.${scale.unit}`);
  // One digit finer than the sight's quantum: a deviation of 0,04 must not read as 0,0.
  const digits = decimalsForQuantum(scale.resolution) + 1;
  const amount = (value: number) => `${formatNumber(Math.abs(value), locale, digits)} ${scaleUnit}`;
  const signed = (value: number) => `${value < 0 ? '−' : '+'}${amount(value)}`;

  const arrowOptions = setup.arrowSets.map((a) => ({ value: a.id, label: a.name }));
  const secondary = view.rows.filter((row) => row.state === 'secondary');

  const rulerMarks: RulerMark[] = view.rows.map((row) => ({
    id: row.id,
    reading: row.reading,
    measured: true,
    label: showDistance(row.distanceM),
    suspect: row.state !== 'ok',
  }));

  const badge = (state: DoctorRowState) =>
    state === 'ok' ? (
      <StatusBadge kind="registered">{t('doctor.statusOk')}</StatusBadge>
    ) : state === 'suspect' ? (
      <StatusBadge kind="suspect">{t('sight.suspect')}</StatusBadge>
    ) : state === 'secondary' ? (
      <StatusBadge kind="suspect">{t('doctor.statusOff')}</StatusBadge>
    ) : (
      <StatusBadge kind="inconsistent">{t('sight.inconsistent')}</StatusBadge>
    );

  const toTheMark = (distanceM: number) =>
    void navigate({
      to: '/setups/$setupId',
      params: { setupId: setup.id },
      search: { ...(arrowId === undefined ? {} : { arrowSet: arrowId }), d: distanceM },
    });

  return (
    <section className="flex flex-col gap-4 pb-8">
      <div className="flex flex-col gap-1">
        <Link
          to="/setups/$setupId"
          params={{ setupId: setup.id }}
          search={{ ...(arrowId === undefined ? {} : { arrowSet: arrowId }) }}
          className="font-ui text-base text-info underline underline-offset-2"
        >
          ‹ {t('doctor.back')}
        </Link>
        <h1 className="font-display text-2xl">{t('screens.doctor')}</h1>
        <p className="font-ui text-base text-muted">
          {nameOf(setup)} · {componentName(setup.sight) ?? ''}
        </p>
      </div>

      {arrowOptions.length === 0 ? (
        <InfoAlert variant="warning">{t('sight.noArrowSets')}</InfoAlert>
      ) : (
        <Select
          label={t('sight.arrows')}
          value={arrowId ?? ''}
          onChange={(event) =>
            void navigate({
              to: '/setups/$setupId/doctor',
              params: { setupId: setup.id },
              search: { arrowSet: event.target.value },
              replace: true,
            })
          }
          options={arrowOptions}
        />
      )}

      <p className="font-ui text-base text-muted">{t('doctor.intro')}</p>

      {marksQuery.isError ? (
        <ErrorState
          title={t('sight.marksLoadError')}
          description={describeError(translate, marksQuery.error).text}
          retryLabel={t('common.retry')}
          onRetry={() => void marksQuery.refetch()}
        />
      ) : marksQuery.isPending ? (
        <div aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : view.status === 'insufficient' ? (
        <InfoAlert variant="info">
          {t('doctor.needs', { need: CALC_MIN_MARKS_INTERPOLATE, count: marks.length })}
        </InfoAlert>
      ) : (
        <>
          <div
            role="status"
            data-verdict={view.status}
            className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4"
          >
            {view.status === 'ok' ? (
              <>
                <h2 className="font-display text-xl">{t('doctor.verdictOk')}</h2>
                <p className="font-ui text-base text-muted">{t('doctor.verdictOkHint')}</p>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl">
                  {t(
                    view.status === 'suspect'
                      ? 'doctor.verdictSuspect'
                      : 'doctor.verdictInconsistent',
                  )}
                </h2>
                {view.suspect === undefined ? null : (
                  <>
                    <p className="font-ui text-lg">
                      {t('doctor.reshoot', {
                        distance: showDistance(view.suspect.distanceM),
                        delta: amount(view.suspect.delta),
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => toTheMark((view.suspect ?? { distanceM: 0 }).distanceM)}
                      style={{ minHeight: 44 }}
                      className="self-start font-ui text-base text-info underline underline-offset-2"
                    >
                      {t('doctor.fix', { distance: showDistance(view.suspect.distanceM) })}
                    </button>
                  </>
                )}
                {view.breaks.map((pair) => (
                  <p key={`${pair.fromM}-${pair.toM}`} className="font-ui text-base">
                    {t('doctor.wrongWay', {
                      from: showDistance(pair.fromM),
                      to: showDistance(pair.toM),
                    })}
                  </p>
                ))}
                {secondary.length === 0 ? null : (
                  <p className="font-ui text-sm text-muted">
                    {t('doctor.alsoOff', {
                      list: secondary.map((row) => showDistance(row.distanceM)).join(', '),
                    })}
                  </p>
                )}
              </>
            )}
            {view.level === 'full' ? null : (
              <p className="font-ui text-sm text-muted">
                {t('doctor.limitedHint', { need: CALC_MIN_MARKS_DOCTOR })}
              </p>
            )}
          </div>

          <div className="grid items-start gap-4 md:grid-cols-2">
            <SectionCard title={t('doctor.tableTitle')} className="min-w-0">
              <table className="w-full border-collapse font-ui text-base">
                <caption className="sr-only">{t('doctor.tableCaption')}</caption>
                <thead>
                  <tr className="text-left text-sm text-muted">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('sight.distance')}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('sight.reading')}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('doctor.deviation')}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t('sight.state')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((row) => (
                    <tr key={row.id} data-state={row.state} className="border-t border-border">
                      <th scope="row" className="py-1 pr-3 text-left font-medium tabular-nums">
                        {showDistance(row.distanceM)}
                      </th>
                      <td className="py-1 pr-3 tabular-nums">
                        {formatReading(row.reading, scale, separator)}
                      </td>
                      <td className="py-1 pr-3 tabular-nums">
                        {row.deviation === undefined ? (
                          '—'
                        ) : (
                          <>
                            {signed(row.deviation)}
                            {row.tolerance === undefined ? null : (
                              <span className="block text-xs text-muted">
                                {t('doctor.tolerance')} ±{amount(row.tolerance)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-1">{badge(row.state)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="font-ui text-sm text-muted">{t('doctor.tableHint')}</p>
            </SectionCard>

            <SectionCard title={t('distances.rulerTitle')} className="min-w-0">
              <Ruler
                scale={scale}
                marks={rulerMarks}
                label={t('sight.rulerLabel')}
                formatValue={(value) => formatReading(value, scale, separator)}
                lengthPx={360}
              />
            </SectionCard>
          </div>
        </>
      )}
    </section>
  );
}
