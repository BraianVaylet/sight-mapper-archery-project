import { formatReading } from '@sight-mapper/domain';
import { formatDate } from '@sight-mapper/i18n';
import type { SetupView } from '@sight-mapper/schemas';
import { Button, ErrorState, InfoAlert, SectionCard, Select, Skeleton } from '@sight-mapper/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { describeError } from '../../app/errors.js';
import { nowIso } from '../../app/device-time.js';
import { useI18n } from '../../app/i18n.js';
import { buildGrid } from '../distances/distances.logic.js';
import { RangeFields, useRange } from '../distances/range-controls.js';
import { componentName } from '../equipment/names.js';
import { useSetupName } from '../setups/home-screen.js';
import { useSightData } from '../sight/sight-data.js';
import { WithSetup } from '../sight/with-setup.js';
import { printSheet } from './print.logic.js';

export type PrintScreenProps = {
  setupId: string;
  /** From the URL (`?arrowSet=`). */
  arrowSetId: string | undefined;
  /** From the URL: the range and step of the list, in the archer's unit. */
  step: number | undefined;
  from: number | undefined;
  to: number | undefined;
};

export function PrintScreen({ setupId, ...rest }: PrintScreenProps) {
  return (
    <WithSetup setupId={setupId}>{(setup) => <PrintView setup={setup} {...rest} />}</WithSetup>
  );
}

function PrintView({
  setup,
  arrowSetId,
  step,
  from,
  to,
}: { setup: SetupView } & Omit<PrintScreenProps, 'setupId'>) {
  const { t, locale, translate } = useI18n();
  const navigate = useNavigate();
  const nameOf = useSetupName();
  const { system, separator, arrowId, marksQuery, marks, scale, analysis } = useSightData(
    setup,
    arrowSetId,
  );

  const go = (search: Record<string, unknown>) =>
    void navigate({
      to: '/setups/$setupId/print',
      params: { setupId: setup.id },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...search }),
      replace: true,
    });
  const rangeState = useRange({ marks, system, step, from, to, go });
  const grid = buildGrid(analysis, rangeState.range, system);
  const sheet = printSheet(grid);

  const unit = t(system === 'metric' ? 'sight.distanceUnitMetric' : 'sight.distanceUnitImperial');
  const arrowOptions = setup.arrowSets.map((a) => ({ value: a.id, label: a.name }));
  const arrowName = setup.arrowSets.find((a) => a.id === arrowId)?.name ?? '';

  const meta: [string, string][] = [
    [t('print.bow'), componentName(setup.bow) ?? ''],
    [t('print.sight'), componentName(setup.sight) ?? ''],
    [t('print.arrows'), arrowName],
    [t('print.date'), formatDate(nowIso(), locale)],
  ];

  return (
    <section className="flex flex-col gap-4 pb-8">
      {/* What is not paper: hidden when printing (see styles.css). */}
      <div className="no-print flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Link
            to="/setups/$setupId"
            params={{ setupId: setup.id }}
            search={{ ...(arrowId === undefined ? {} : { arrowSet: arrowId }) }}
            className="font-ui text-base text-info underline underline-offset-2"
          >
            ‹ {t('print.back')}
          </Link>
          <h1 className="font-display text-2xl">{t('screens.print')}</h1>
          <p className="font-ui text-base text-muted">{t('print.intro')}</p>
        </div>

        {arrowOptions.length === 0 ? null : (
          <Select
            label={t('sight.arrows')}
            value={arrowId ?? ''}
            onChange={(event) => go({ arrowSet: event.target.value })}
            options={arrowOptions}
          />
        )}

        {marks.length === 0 ? null : (
          <SectionCard title={t('distances.rangeTitle')}>
            <RangeFields state={rangeState} unit={unit} />
          </SectionCard>
        )}

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
        ) : marks.length === 0 ? (
          <InfoAlert variant="info">{t('print.noMarks')}</InfoAlert>
        ) : !grid.ok ? (
          <InfoAlert variant="warning">
            {t(grid.error === 'range' ? 'distances.rangeError' : 'distances.tooMany')}
          </InfoAlert>
        ) : (
          <div className="flex flex-col gap-1">
            <Button onClick={() => window.print()} disabled={sheet.rows.length === 0}>
              {t('print.button')}
            </Button>
            <p className="font-ui text-sm text-muted">{t('print.pdfHint')}</p>
          </div>
        )}
      </div>

      {marksQuery.isPending || marks.length === 0 || !grid.ok ? null : (
        <article
          aria-label={t('print.sheetTitle')}
          className="print-sheet flex flex-col gap-4 rounded-md border border-border bg-white p-6 text-black"
        >
          <div className="flex flex-col gap-1 border-b border-black pb-3">
            <h2 className="font-display text-2xl">{t('print.sheetTitle')}</h2>
            <p className="font-ui text-lg font-semibold">{nameOf(setup)}</p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-ui text-base">
            {meta.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-semibold">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <dt className="font-semibold">{t('print.unitLine')}</dt>
            <dd>{t('print.step', { step: rangeState.range.step, unit })}</dd>
          </dl>

          <table className="w-full max-w-md border-collapse font-ui text-lg">
            <caption className="sr-only">{t('print.tableCaption')}</caption>
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th scope="col" className="py-1 pr-6 font-semibold">
                  {t('sight.distance')}
                </th>
                <th scope="col" className="py-1 font-semibold">
                  {t('sight.reading')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr
                  key={row.distance}
                  data-measured={row.measured}
                  className="border-b border-black/30"
                >
                  <th scope="row" className="py-1 pr-6 text-left font-semibold tabular-nums">
                    {row.distance} {unit}
                  </th>
                  <td className={`py-1 tabular-nums ${row.measured ? 'font-semibold' : ''}`}>
                    {row.measured ? '' : '≈ '}
                    {formatReading(row.reading, scale, separator)}
                    {row.caution ? ' *' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-col gap-0.5 font-ui text-sm">
            <li>{t('print.footMeasured')}</li>
            {sheet.hasEstimates ? <li>{t('print.footEstimated')}</li> : null}
            {sheet.hasCautions ? <li>{t('print.footCaution')}</li> : null}
            {sheet.omitted === 0 ? null : <li>{t('print.omitted', { count: sheet.omitted })}</li>}
          </ul>
        </article>
      )}
    </section>
  );
}
