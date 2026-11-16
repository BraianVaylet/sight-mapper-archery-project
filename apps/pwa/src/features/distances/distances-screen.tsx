import { formatReading } from '@sight-mapper/domain';
import { formatNumber } from '@sight-mapper/i18n';
import type { SetupView } from '@sight-mapper/schemas';
import {
  Button,
  ErrorState,
  InfoAlert,
  NumberField,
  SectionCard,
  Select,
  Skeleton,
  StatusBadge,
} from '@sight-mapper/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { componentName } from '../equipment/names.js';
import { useSetupName } from '../setups/home-screen.js';
import { WithSetup } from '../sight/with-setup.js';
import { Ruler, type RulerMark } from '../sight/ruler.js';
import { calcFailureText } from '../sight/calc-failure.js';
import { useSightData } from '../sight/sight-data.js';
import { distanceIn, formatDistance, readingOf, type Reading } from '../sight/sight.logic.js';
import { DistanceCurve } from './distance-curve.js';
import { RangeFields, useRange } from './range-controls.js';
import { buildGrid, curveGeometry, freeQuery, type FreeQuery } from './distances.logic.js';

/** Marker glyphs: not words, so they stay out of the catalogs. */
const GLYPH = { filled: '● ', estimate: '◇ ' } as const;

const CURVE = { width: 340, height: 230 } as const;

export type DistancesScreenProps = {
  setupId: string;
  /** From the URL (`?arrowSet=`). */
  arrowSetId: string | undefined;
  /** From the URL (`?d=`): the selected distance, in metres. */
  distanceM: number | undefined;
  /** From the URL: the range and step of the table, in the archer's unit. */
  step: number | undefined;
  from: number | undefined;
  to: number | undefined;
};

export function DistancesScreen({ setupId, ...rest }: DistancesScreenProps) {
  return (
    <WithSetup setupId={setupId}>{(setup) => <DistancesView setup={setup} {...rest} />}</WithSetup>
  );
}

function ReadingBadge({ reading }: { reading: Reading }) {
  const { t } = useI18n();
  if (!reading.ok) return null;
  return reading.kind === 'measured' ? (
    <StatusBadge kind="registered">{t('sight.registered')}</StatusBadge>
  ) : (
    <StatusBadge kind="calculated">{t('sight.calculated')}</StatusBadge>
  );
}

function DistancesView({
  setup,
  arrowSetId,
  distanceM,
  step: stepParam,
  from: fromParam,
  to: toParam,
}: { setup: SetupView } & Omit<DistancesScreenProps, 'setupId'>) {
  const { t, locale, translate } = useI18n();
  const navigate = useNavigate();
  const nameOf = useSetupName();
  const { system, separator, arrowId, marksQuery, marks, scale, analysis } = useSightData(
    setup,
    arrowSetId,
  );

  const unit = t(system === 'metric' ? 'sight.distanceUnitMetric' : 'sight.distanceUnitImperial');
  const showUnitDistance = (distance: number) =>
    `${formatNumber(distance, locale, Number.isInteger(distance) ? 0 : 1)} ${unit}`;
  const showDistance = (m: number) => formatDistance(m, system, locale, unit);
  const readingText = (r: Reading) => (r.ok ? formatReading(r.reading, scale, separator) : '—');
  const explainFailure = (r: Reading) => calcFailureText(translate, r, { system, locale, scale });

  // --- what is on screen: the URL, with what the marks suggest where it says nothing -----------
  const go = (search: Record<string, unknown>) =>
    void navigate({
      to: '/setups/$setupId/distances',
      params: { setupId: setup.id },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...search }),
      replace: true,
    });
  const rangeState = useRange({
    marks,
    system,
    step: stepParam,
    from: fromParam,
    to: toParam,
    go,
  });
  const { range } = rangeState;
  const grid = buildGrid(analysis, range, system);

  // --- the selected distance and the free query --------------------------------------------------
  const selected = distanceM === undefined ? undefined : analysis.readingAt(distanceM);
  const selectedRow =
    grid.ok && distanceM !== undefined
      ? grid.rows.find((row) => Math.abs(row.distanceM - distanceM) < 0.001)
      : undefined;
  const selectedMark = marks.find((m) => m.distanceM === distanceM);

  const [queryText, setQueryText] = useState('');
  const [queryError, setQueryError] = useState<FreeQuery | undefined>(undefined);
  const askReading = () => {
    const result = freeQuery(analysis, queryText, system);
    setQueryError(result.ok ? undefined : result);
    if (result.ok) go({ d: result.distanceM });
  };
  const queryMessage =
    queryError === undefined || queryError.ok
      ? undefined
      : queryError.error === 'required'
        ? t('validation.required')
        : queryError.error === 'number'
          ? t('mark.errors.number')
          : translate('mark.errors.distanceRange', {
              max: `${formatNumber(distanceIn(300, system), locale, 0)} ${unit}`,
            });

  // --- the curve and the ruler -------------------------------------------------------------------
  const asked =
    selected !== undefined && selected.ok && selectedRow === undefined && selectedMark === undefined
      ? { distance: distanceIn(selected.distanceM, system), reading: selected.reading }
      : undefined;
  const geometry = curveGeometry(grid.ok ? grid.rows : [], CURVE, asked);

  const rulerMarks: RulerMark[] = [
    ...marks.map((m) => ({
      id: m.id,
      reading: readingOf(m.scaleValueMm, scale),
      measured: true,
      label: showDistance(m.distanceM),
    })),
    ...(selected !== undefined && selected.ok && selectedMark === undefined && !selected.outOfScale
      ? [
          {
            id: 'selected',
            reading: selected.reading,
            measured: false,
            label: t('sight.estimated', { reading: showDistance(selected.distanceM) }),
          },
        ]
      : []),
  ];

  const arrowOptions = setup.arrowSets.map((a) => ({ value: a.id, label: a.name }));
  const canCalculate = analysis.tier !== 'none';

  return (
    <section className="flex flex-col gap-4 pb-8">
      <div className="flex flex-col gap-1">
        <Link
          to="/setups/$setupId"
          params={{ setupId: setup.id }}
          search={{ ...(arrowId === undefined ? {} : { arrowSet: arrowId }) }}
          className="font-ui text-base text-info underline underline-offset-2"
        >
          ‹ {t('distances.back')}
        </Link>
        <h1 className="font-display text-2xl">{t('screens.distances')}</h1>
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
          onChange={(event) => go({ arrowSet: event.target.value, d: undefined })}
          options={arrowOptions}
        />
      )}

      <div
        aria-live="polite"
        className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4"
      >
        <p className="font-ui text-sm tracking-widest text-muted uppercase">
          {t('distances.selected')}
        </p>
        {distanceM === undefined || selected === undefined ? (
          <p className="font-ui text-base text-muted">{t('distances.pick')}</p>
        ) : (
          <>
            <p className="font-display text-4xl tabular-nums">
              {showDistance(distanceM)}
              <span className="text-muted"> → </span>
              {selected.ok && selected.kind !== 'measured' ? '≈ ' : ''}
              {readingText(selected)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ReadingBadge reading={selected} />
              {selected.ok && selected.lowConfidence ? (
                <span className="text-sm text-warning">{t('sight.lowConfidence')}</span>
              ) : null}
              {selected.ok && selected.outOfScale ? (
                <span className="text-sm text-warning">{t('sight.outOfScale')}</span>
              ) : null}
              {!selected.ok ? (
                <span className="text-sm text-muted">{explainFailure(selected)}</span>
              ) : null}
            </div>
          </>
        )}
      </div>

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
      ) : !canCalculate ? (
        <InfoAlert variant="info">{t('sight.needs', { need: 2, count: marks.length })}</InfoAlert>
      ) : (
        <>
          <SectionCard title={t('distances.customTitle')}>
            <form
              noValidate
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                askReading();
              }}
            >
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <NumberField
                    label={t('distances.customLabel')}
                    unit={unit}
                    value={queryText}
                    onChange={(event) => setQueryText(event.target.value)}
                    error={queryMessage}
                  />
                </div>
                <Button type="submit">{t('distances.customButton')}</Button>
              </div>
              <p className="font-ui text-sm text-muted">
                {t('distances.customHint')}
                {analysis.tier === 'extrapolate' ? ` ${t('distances.customHintExtrapolate')}` : ''}
              </p>
            </form>
          </SectionCard>

          <SectionCard title={t('distances.rangeTitle')}>
            <RangeFields state={rangeState} unit={unit} />

            {!grid.ok ? (
              <InfoAlert variant="warning">
                {t(grid.error === 'range' ? 'distances.rangeError' : 'distances.tooMany')}
              </InfoAlert>
            ) : (
              <>
                <h3 className="font-ui text-sm tracking-widest text-muted uppercase">
                  {t('distances.curveTitle')}
                </h3>
                <DistanceCurve
                  geometry={geometry}
                  width={CURVE.width}
                  height={CURVE.height}
                  label={t('distances.curveLabel')}
                  xTitle={t('distances.xAxis', { unit })}
                  yTitle={t('distances.yAxis')}
                  formatX={(value) => formatNumber(value, locale, 0)}
                  formatY={(value) => formatReading(value, scale, separator)}
                  selectedDistance={
                    selectedRow?.distance ??
                    (distanceM === undefined ? undefined : distanceIn(distanceM, system))
                  }
                  onSelect={(distance) => {
                    const row = grid.rows.find((r) => r.distance === distance);
                    if (row !== undefined) go({ d: row.distanceM });
                  }}
                />
                <p className="flex flex-wrap gap-4 font-ui text-sm">
                  <span>
                    {GLYPH.filled}
                    {t('distances.legendMeasured')}
                  </span>
                  <span>
                    {GLYPH.estimate}
                    {t('distances.legendCalculated')}
                  </span>
                </p>
                {selected !== undefined && selected.ok ? (
                  <p className="font-ui text-sm text-muted">
                    {t('distances.summary', {
                      count: marks.length,
                      distance: showDistance(selected.distanceM),
                      reading: `${selected.kind === 'measured' ? '' : '≈ '}${readingText(selected)}`,
                    })}
                  </p>
                ) : (
                  <p className="font-ui text-sm text-muted">{t('distances.noQuery')}</p>
                )}

                <table className="w-full border-collapse font-ui text-base">
                  <caption className="sr-only">{t('distances.tableCaption')}</caption>
                  <thead>
                    <tr className="text-left text-sm text-muted">
                      <th scope="col" className="py-1 pr-3 font-medium">
                        {t('sight.distance')}
                      </th>
                      <th scope="col" className="py-1 pr-3 font-medium">
                        {t('sight.reading')}
                      </th>
                      <th scope="col" className="py-1 pr-3 font-medium">
                        {t('sight.state')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.rows.map((row) => {
                      const isSelected = row === selectedRow;
                      return (
                        <tr
                          key={row.distance}
                          aria-selected={isSelected}
                          className={`border-t border-border ${isSelected ? 'bg-sunken' : ''}`}
                        >
                          <th scope="row" className="py-1 pr-3 text-left font-medium tabular-nums">
                            <button
                              type="button"
                              aria-label={t('distances.selectRow', {
                                distance: showUnitDistance(row.distance),
                              })}
                              aria-current={isSelected ? 'true' : undefined}
                              style={{ minHeight: 44, minWidth: 44 }}
                              className="text-left underline-offset-2 hover:underline"
                              onClick={() => go({ d: row.distanceM })}
                            >
                              {showUnitDistance(row.distance)}
                            </button>
                          </th>
                          <td className="py-1 pr-3 tabular-nums">
                            {row.reading.ok && row.reading.kind !== 'measured' ? '≈ ' : ''}
                            {readingText(row.reading)}
                          </td>
                          <td className="py-1">
                            <ReadingBadge reading={row.reading} />
                            {row.reading.ok ? (
                              <>
                                {row.reading.lowConfidence ? (
                                  <span className="block text-sm text-warning">
                                    {t('sight.lowConfidence')}
                                  </span>
                                ) : null}
                                {row.reading.outOfScale ? (
                                  <span className="block text-sm text-warning">
                                    {t('sight.outOfScale')}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="block text-sm text-muted">
                                {explainFailure(row.reading)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </SectionCard>

          <SectionCard title={t('distances.rulerTitle')}>
            <Ruler
              scale={scale}
              marks={rulerMarks}
              label={t('sight.rulerLabel')}
              formatValue={(value) => formatReading(value, scale, separator)}
              lengthPx={360}
              selectedId={
                selectedMark?.id ??
                (rulerMarks.some((m) => m.id === 'selected') ? 'selected' : undefined)
              }
            />
          </SectionCard>
        </>
      )}
    </section>
  );
}
