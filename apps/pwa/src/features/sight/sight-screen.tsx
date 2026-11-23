import { isApiError } from '@sight-mapper/client';
import { formatReading } from '@sight-mapper/domain';
import { formatNumber } from '@sight-mapper/i18n';
import type { CreateMark, Mark, SetupView } from '@sight-mapper/schemas';
import {
  ACTION_TOOL_CLASS,
  ActionBar,
  ActionToolUnavailable,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  InfoAlert,
  ReadingHud,
  SectionCard,
  Select,
  Skeleton,
  StatusBadge,
  Toast,
  cx,
  touchTarget,
} from '@sight-mapper/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type KeyboardEvent } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { QuickAccessToggle } from '../account/quick-access-toggle.js';
import { componentName } from '../equipment/names.js';
import { useSetupName } from '../setups/home-screen.js';
import { setupHooks } from '../setups/setups.js';
import { calcFailureText } from './calc-failure.js';
import { cachedMark, useMarkActions } from './marks.js';
import type { MarkFormValues } from './mark-form.logic.js';
import { MarkSheet } from './mark-sheet.js';
import { Ruler, type RulerMark } from './ruler.js';
import { useSightData } from './sight-data.js';
import {
  CALC_MIN_MARKS_INTERPOLATE,
  distanceIn,
  formatDistance,
  doctorProgress,
  readingOf,
  showReading,
  type Reading,
} from './sight.logic.js';

/** Marker glyphs: not words, so they stay out of the catalogs. */
const GLYPH = { open: '○ ', filled: '● ', estimate: '◇ ' } as const;

export type SightScreenProps = {
  setupId: string;
  /** From the URL (`?arrowSet=`): which arrow set is on screen. */
  arrowSetId: string | undefined;
  /** From the URL (`?d=`): the selected distance, in metres. */
  distanceM: number | undefined;
};

type SheetState = {
  mode: 'new' | 'edit';
  mark?: Mark;
  initial?: MarkFormValues;
  error?: string;
};

type Pending = {
  input: CreateMark;
  existingId: string | undefined;
  values: MarkFormValues;
  mark?: Mark;
};

type ToastState = { message: string; undo: () => Promise<unknown> };

export function SightScreen({ setupId, arrowSetId, distanceM }: SightScreenProps) {
  const { t, translate } = useI18n();
  const detail = setupHooks.useDetail(setupId);

  if (detail.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (detail.isError) {
    return (
      <ErrorState
        title={t('sight.loadError')}
        description={describeError(translate, detail.error).text}
        retryLabel={t('common.retry')}
        onRetry={() => void detail.refetch()}
      />
    );
  }
  return <SightView setup={detail.data} arrowSetId={arrowSetId} distanceM={distanceM} />;
}

/** The state of a reading as a badge: measured, estimated, or pointed at by the Doctor. */
function ReadingBadge({
  reading,
  suspect,
  inconsistent,
}: {
  reading: Reading | undefined;
  suspect: boolean;
  inconsistent: boolean;
}) {
  const { t } = useI18n();
  if (reading === undefined || !reading.ok) return null;
  if (inconsistent) return <StatusBadge kind="inconsistent">{t('sight.inconsistent')}</StatusBadge>;
  if (suspect) return <StatusBadge kind="suspect">{t('sight.suspect')}</StatusBadge>;
  return reading.kind === 'measured' ? (
    <StatusBadge kind="registered">{t('sight.registered')}</StatusBadge>
  ) : (
    <StatusBadge kind="calculated">{t('sight.calculated')}</StatusBadge>
  );
}

/** Intermediates and the curve: from two marks on; before that, visible and announced as unavailable. */
function DistancesTool({
  setupId,
  arrowSetId,
  count,
}: {
  setupId: string;
  arrowSetId: string | undefined;
  count: number;
}) {
  const { t } = useI18n();
  if (count < CALC_MIN_MARKS_INTERPOLATE) {
    return (
      <ActionToolUnavailable
        icon={<Icon name="curve" />}
        label={t('sight.distances')}
        badge={`${count}/${CALC_MIN_MARKS_INTERPOLATE}`}
      />
    );
  }
  return (
    <Link
      to="/setups/$setupId/distances"
      params={{ setupId }}
      search={arrowSetId === undefined ? {} : { arrowSet: arrowSetId }}
      className={cx(ACTION_TOOL_CLASS, 'text-text hover:bg-raised')}
    >
      <Icon name="curve" />
      <span className="max-w-full hyphens-auto [overflow-wrap:anywhere]">
        {t('sight.distances')}
      </span>
    </Link>
  );
}

function SightView({
  setup,
  arrowSetId: arrowParam,
  distanceM: distanceParam,
}: { setup: SetupView } & Omit<SightScreenProps, 'setupId'>) {
  const { t, locale, translate } = useI18n();
  const client = useQueryClient();
  const navigate = useNavigate();
  const nameOf = useSetupName();
  const { system, separator, arrowId, marksQuery, marks, scale, windageScale, analysis } =
    useSightData(setup, arrowParam);
  const actions = useMarkActions(setup.id, arrowId ?? '');

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [undoError, setUndoError] = useState(false);

  const unit = t(system === 'metric' ? 'sight.distanceUnitMetric' : 'sight.distanceUnitImperial');
  const showDistance = (m: number) => formatDistance(m, system, locale, unit);
  const readingText = (r: Reading) => (r.ok ? formatReading(r.reading, scale, separator) : '—');
  /** "Deriva 2,5" for a measured mark with a windage; nothing otherwise (it is never estimated). */
  const windageText = (m: Mark | undefined) =>
    m === undefined || m.windageMm === null || windageScale === null
      ? undefined
      : t('sight.windage', { reading: showReading(m.windageMm, windageScale, separator) });

  const selectedM = distanceParam ?? marks[0]?.distanceM;
  const selected = selectedM === undefined ? undefined : analysis.readingAt(selectedM);
  const selectedMark = marks.find((m) => m.distanceM === selectedM);

  const go = (search: { arrowSet?: string | undefined; d?: number | undefined }) =>
    void navigate({
      to: '/setups/$setupId',
      params: { setupId: setup.id },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...search }),
      replace: true,
    });

  /** Table order with the arrow keys: the next or previous mark becomes the selection. */
  const onTableKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const index = marks.findIndex((m) => m.distanceM === selectedM);
    const next = marks[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next !== undefined) go({ d: next.distanceM });
  };

  const rulerMarks: RulerMark[] = [
    ...marks.map((m) => ({
      id: m.id,
      reading: readingOf(m.scaleValueMm, scale),
      measured: true,
      label: showDistance(m.distanceM),
      suspect: analysis.suspectIds.has(m.id) || analysis.inconsistentIds.has(m.id),
    })),
    ...(selected !== undefined && selected.ok && selectedMark === undefined && !selected.outOfScale
      ? [
          {
            id: 'selected',
            reading: selected.reading,
            measured: false,
            label: t('sight.estimated', { reading: `${showDistance(selected.distanceM)}` }),
          },
        ]
      : []),
  ];

  /** The windage ruler: measured marks with a windage only (F1-42). */
  const windageMarks: RulerMark[] =
    windageScale === null
      ? []
      : marks.flatMap((m) =>
          m.windageMm === null
            ? []
            : [
                {
                  id: m.id,
                  reading: readingOf(m.windageMm, windageScale),
                  measured: true,
                  label: showDistance(m.distanceM),
                },
              ],
        );

  // --- saving: the list takes the change first (RF-X-04) --------------------------------------
  const units = { system, locale, scale };
  const explain = (error: unknown) => describeError(translate, error, units).text;

  const remember = (message: string, undo: () => Promise<unknown>) => {
    setUndoError(false);
    setToast({ message, undo });
  };

  async function save(
    input: CreateMark,
    values: MarkFormValues,
    mark: Mark | undefined,
    replace = false,
  ) {
    setSheet(null);
    setPending(null);
    try {
      if (mark === undefined) {
        const saved = await actions.create({
          input: { ...input, replace },
          idempotencyKey: actions.newIdempotencyKey(),
        });
        go({ d: saved.distanceM });
        remember(t('mark.saved'), () => actions.remove({ id: saved.id }));
      } else {
        const before = mark;
        const saved = await actions.update({
          id: mark.id,
          patch: {
            distanceM: input.distanceM,
            scaleValueMm: input.scaleValueMm,
            windageMm: input.windageMm ?? null,
            note: input.note ?? null,
            measuredAt: input.measuredAt,
            ...(replace ? { replace: true } : {}),
          },
        });
        go({ d: saved.distanceM });
        remember(t('mark.updated'), () =>
          actions.update({
            id: saved.id,
            patch: {
              distanceM: before.distanceM,
              scaleValueMm: before.scaleValueMm,
              windageMm: before.windageMm,
              note: before.note ?? null,
              measuredAt: before.measuredAt,
            },
          }),
        );
      }
    } catch (error) {
      if (isApiError(error) && error.code === 'SM-MARK-409-001') {
        setPending({
          input,
          values,
          ...(mark === undefined ? {} : { mark }),
          existingId: String(error.params['existingMarkId'] ?? ''),
        });
      } else {
        // The sheet comes back with what the archer typed, and says why it did not save.
        setSheet({
          mode: mark === undefined ? 'new' : 'edit',
          ...(mark === undefined ? {} : { mark }),
          initial: values,
          error: explain(error),
        });
      }
    }
  }

  async function removeMark(mark: Mark) {
    setSheet(null);
    try {
      await actions.remove({ id: mark.id });
      remember(t('mark.deleted'), () => actions.restore(mark.id));
    } catch (error) {
      setSheet({ mode: 'edit', mark, error: explain(error) });
    }
  }

  const existing = pending === null ? undefined : cachedMark(client, pending.existingId ?? '');
  const arrowOptions = setup.arrowSets.map((a) => ({ value: a.id, label: a.name }));
  const progress = doctorProgress(analysis.count);
  const firstDistance = marks[0]?.distanceM;
  const lastDistance = marks[marks.length - 1]?.distanceM;

  const toolLink = (to: '/setups/$setupId/doctor' | '/setups/$setupId/print') =>
    ({
      to,
      params: { setupId: setup.id },
      search: arrowId === undefined ? {} : { arrowSet: arrowId },
      className: cx(ACTION_TOOL_CLASS, 'text-text hover:bg-raised'),
    }) as const;

  const hudDistance =
    selectedM === undefined ? '' : formatDistance(selectedM, system, locale, '').trim();
  const estimate = selected !== undefined && selected.ok && selected.kind !== 'measured';

  const barShown = sheet === null && pending === null;
  const toastNode = (inline: boolean) =>
    toast === null ? null : (
      <Toast
        key={toast.message}
        inline={inline}
        message={toast.message}
        actionLabel={t('common.undo')}
        onAction={() => {
          const undo = toast.undo;
          setToast(null);
          void undo().catch(() => setUndoError(true));
        }}
        dismissLabel={t('common.close')}
        onDismiss={() => setToast(null)}
      />
    );

  return (
    // Room at the bottom for the fixed action bar: nothing hides behind it.
    <section className="flex flex-col gap-4 pb-64">
      <div className="flex flex-col gap-1">
        <Link
          to="/"
          className="inline-flex min-h-12 items-center gap-1 self-start font-ui text-base text-info underline underline-offset-[3px]"
        >
          <Icon name="back" />
          {t('sight.back')}
        </Link>
        <h1 className="font-display text-3xl font-bold">{nameOf(setup)}</h1>
        <p className="font-mono text-sm text-muted">
          {componentName(setup.sight) ?? ''}
          {firstDistance === undefined || lastDistance === undefined
            ? ` · ${t('sight.summary', { count: 0 })}`
            : ` · ${t('sight.summaryRange', {
                count: marks.length,
                from: formatNumber(distanceIn(firstDistance, system), locale, 0),
                to: formatNumber(distanceIn(lastDistance, system), locale, 0),
                unit,
              })}`}
        </p>
      </div>

      {/* 768 and up: the reading on the left, the scale and the marks on the right (UX-UI §7). */}
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4 md:sticky md:top-4">
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

          <ReadingHud
            {...(selectedM === undefined || selected === undefined
              ? { placeholder: t('sight.readoutPick') }
              : {})}
            distance={{ label: t('sight.distance'), value: hudDistance, unit }}
            reading={{
              label:
                selectedM === undefined
                  ? t('sight.reading')
                  : t('sight.readout', { distance: showDistance(selectedM) }),
              value:
                selected === undefined ? '' : `${estimate ? '≈ ' : ''}${readingText(selected)}`,
              tone:
                selected === undefined || !selected.ok
                  ? 'none'
                  : selected.kind === 'measured'
                    ? 'measured'
                    : 'estimated',
            }}
            footer={
              selected === undefined ? undefined : (
                <>
                  <ReadingBadge
                    reading={selected}
                    suspect={selectedMark !== undefined && analysis.suspectIds.has(selectedMark.id)}
                    inconsistent={
                      selectedMark !== undefined && analysis.inconsistentIds.has(selectedMark.id)
                    }
                  />
                  {selected.ok &&
                  selected.kind === 'measured' &&
                  windageText(selectedMark) !== undefined ? (
                    <span className="font-mono text-sm font-medium text-mark">
                      {windageText(selectedMark)}
                    </span>
                  ) : null}
                  {selected.ok && selected.lowConfidence ? (
                    <span className="font-ui text-sm text-warning">{t('sight.lowConfidence')}</span>
                  ) : null}
                  {selected.ok && selected.outOfScale ? (
                    <span className="font-ui text-sm text-warning">{t('sight.outOfScale')}</span>
                  ) : null}
                  {!selected.ok ? (
                    <span className="font-ui text-sm text-muted">
                      {calcFailureText(translate, selected, units)}
                    </span>
                  ) : null}
                </>
              )
            }
          />

          {analysis.tier === 'none' && marks.length > 0 ? (
            <InfoAlert variant="info">
              {t('sight.needs', { need: 2, count: marks.length })}
            </InfoAlert>
          ) : null}

          <QuickAccessToggle setupId={setup.id} arrowSetId={arrowId} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {marksQuery.isError ? (
            <ErrorState
              title={t('sight.marksLoadError')}
              description={explain(marksQuery.error)}
              retryLabel={t('common.retry')}
              onRetry={() => void marksQuery.refetch()}
            />
          ) : marksQuery.isPending ? (
            <div aria-busy="true">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : marks.length === 0 ? (
            <EmptyState
              title={t('sight.emptyTitle')}
              description={t('sight.emptyHint')}
              action={
                <div className="flex flex-col items-center gap-3">
                  <ul className="flex flex-col gap-1 text-left font-ui text-base">
                    <li>
                      <span aria-hidden="true" className="text-mark">
                        {arrowId === undefined ? GLYPH.open : GLYPH.filled}
                      </span>
                      {t('sight.stepArrows')}
                    </li>
                    <li>
                      <span aria-hidden="true">{GLYPH.open}</span>
                      {t('sight.stepMark')}
                    </li>
                  </ul>
                  <InfoAlert variant="info">{t('sight.needs', { need: 2, count: 0 })}</InfoAlert>
                </div>
              }
            />
          ) : (
            <>
              <SectionCard index="01" title={t('sight.tableTitle')} count={marks.length}>
                {/* A wide system font must not push the page sideways: the table scrolls on its own. */}
                <div className="-mx-4 overflow-x-auto">
                  <table
                    className="w-full border-collapse font-ui text-base"
                    onKeyDown={onTableKey}
                  >
                    <caption className="sr-only">{t('sight.tableCaption')}</caption>
                    <thead>
                      <tr className="border-y-2 border-border bg-raised text-left font-mono text-xs tracking-[0.12em] text-muted uppercase">
                        <th scope="col" className="py-2 pr-2 pl-4 font-semibold">
                          {t('sight.distance')}
                        </th>
                        <th scope="col" className="py-2 pr-2 font-semibold">
                          {t('sight.reading')}
                        </th>
                        <th scope="col" className="py-2 pr-2 font-semibold">
                          {t('sight.state')}
                        </th>
                        <th scope="col" className="py-2 pr-1">
                          <span className="sr-only">{t('setups.home.edit')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((m) => {
                        const isSelected = m.distanceM === selectedM;
                        const reading = analysis.readingAt(m.distanceM);
                        return (
                          <tr
                            key={m.id}
                            aria-selected={isSelected}
                            className={cx(
                              'h-[60px] border-b-2 border-line last:border-b-0',
                              isSelected && 'bg-raised',
                            )}
                          >
                            <th
                              scope="row"
                              className={cx(
                                'border-l-4 py-1 pr-2 pl-3 text-left',
                                isSelected ? 'border-accent' : 'border-transparent',
                              )}
                            >
                              <button
                                type="button"
                                aria-label={t('sight.selectMark', {
                                  distance: showDistance(m.distanceM),
                                })}
                                aria-current={isSelected ? 'true' : undefined}
                                style={touchTarget}
                                className="text-left font-mono text-xl font-medium tabular-nums underline-offset-4 hover:underline"
                                onClick={() => go({ d: m.distanceM })}
                              >
                                {showDistance(m.distanceM)}
                              </button>
                            </th>
                            <td className="py-1 pr-1 font-mono text-lg font-medium text-mark tabular-nums">
                              {readingText(reading)}
                              {windageText(m) === undefined ? null : (
                                <span className="block font-mono text-xs font-medium text-muted">
                                  {windageText(m)}
                                </span>
                              )}
                            </td>
                            <td className="py-1 pr-1">
                              <ReadingBadge
                                reading={reading}
                                suspect={analysis.suspectIds.has(m.id)}
                                inconsistent={analysis.inconsistentIds.has(m.id)}
                              />
                            </td>
                            <td className="py-1 pr-1 text-right">
                              {/* An icon: the four columns must fit 360 px; the name says it all. */}
                              <Button
                                variant="ghost"
                                style={{ paddingInline: 0 }}
                                aria-label={t('sight.editMark', {
                                  distance: showDistance(m.distanceM),
                                })}
                                onClick={() => setSheet({ mode: 'edit', mark: m })}
                              >
                                <Icon name="edit" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard index="02" title={t('sight.rulerTitle')}>
                <div className="flex justify-center rounded-sm border-2 border-border bg-sunken py-2">
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
                    onSelect={(id) => {
                      const picked = marks.find((m) => m.id === id);
                      if (picked !== undefined) go({ d: picked.distanceM });
                    }}
                  />
                </div>
                <p
                  className="flex flex-wrap gap-4 font-mono text-xs tracking-[0.08em] uppercase"
                  aria-label={t('sight.legend')}
                >
                  <span className="text-mark">
                    {GLYPH.filled}
                    {t('sight.registered')}
                  </span>
                  <span className="text-info">
                    {GLYPH.estimate}
                    {t('sight.calculated')}
                  </span>
                </p>
              </SectionCard>

              <SectionCard index="03" title={t('sight.windageTitle')}>
                {windageScale === null ? (
                  <div className="flex flex-col gap-2">
                    <InfoAlert variant="info">{t('sight.windageNoScale')}</InfoAlert>
                    <Link
                      to="/sights/$id"
                      params={{ id: setup.sight.id }}
                      className="inline-flex min-h-12 items-center self-start font-ui text-base text-info underline underline-offset-[3px]"
                    >
                      {t('sight.windageEditSight')}
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center overflow-x-auto rounded-sm border-2 border-border bg-sunken py-2">
                      <Ruler
                        orientation="horizontal"
                        scale={windageScale}
                        marks={windageMarks}
                        label={t('sight.windageRulerLabel')}
                        formatValue={(value) => formatReading(value, windageScale, separator)}
                        lengthPx={300}
                        selectedId={selectedMark?.id}
                        onSelect={(id) => {
                          const picked = marks.find((m) => m.id === id);
                          if (picked !== undefined) go({ d: picked.distanceM });
                        }}
                      />
                    </div>
                    {windageMarks.length === 0 ? (
                      <p className="font-ui text-sm text-muted">{t('sight.windageNone')}</p>
                    ) : null}
                  </>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>

      <ActionBar
        hidden={!barShown}
        notice={toastNode(true)}
        toolsLabel={t('sight.tools')}
        tools={
          <>
            <DistancesTool setupId={setup.id} arrowSetId={arrowId} count={analysis.count} />
            {progress.ready ? (
              <Link {...toolLink('/setups/$setupId/doctor')}>
                <Icon name="doctor" />
                <span>{t('sight.doctor')}</span>
              </Link>
            ) : (
              <ActionToolUnavailable
                icon={<Icon name="doctor" />}
                label={t('sight.doctor')}
                badge={t('sight.doctorNeeds', { have: progress.have, need: progress.need })}
              />
            )}
            {marks.length > 0 ? (
              <Link {...toolLink('/setups/$setupId/print')}>
                <Icon name="print" />
                <span>{t('sight.print')}</span>
              </Link>
            ) : (
              <ActionToolUnavailable
                icon={<Icon name="print" />}
                label={t('sight.print')}
                badge="0/1"
              />
            )}
            {/* Wind and weather, not built yet: one cell, both named (RF-X-07, D-1). */}
            <button
              type="button"
              aria-disabled="true"
              className={cx(ACTION_TOOL_CLASS, 'cursor-not-allowed text-muted')}
            >
              <Icon name="wind" />
              <span className="leading-4">
                <span>{t('sight.wind')}</span> · <span>{t('sight.weather')}</span>
              </span>
              <span className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
                {t('sight.soonShort')}
              </span>
            </button>
          </>
        }
        primary={
          <Button
            size="lg"
            block
            onClick={() => setSheet({ mode: 'new' })}
            disabled={arrowId === undefined}
          >
            {t('sight.add')}
          </Button>
        }
        strip={{
          left: `${nameOf(setup)} · ${componentName(setup.sight) ?? ''}`,
          right:
            selectedM === undefined || selected === undefined
              ? undefined
              : `${showDistance(selectedM)} · ${readingText(selected)}`,
        }}
      />

      {sheet === null || arrowId === undefined ? null : (
        <MarkSheet
          // A fresh form per open, and per failed attempt that comes back.
          key={`${sheet.mode}-${sheet.mark?.id ?? 'new'}-${sheet.error ?? ''}`}
          mode={sheet.mode}
          mark={sheet.mark}
          initial={sheet.initial}
          error={sheet.error}
          ids={{ setupId: setup.id, arrowSetId: arrowId }}
          scale={scale}
          windageScale={windageScale}
          sightId={setup.sight.id}
          system={system}
          onClose={() => setSheet(null)}
          onSubmit={(input, values) => void save(input, values, sheet.mark)}
          onDelete={
            sheet.mark === undefined ? undefined : () => void removeMark(sheet.mark as Mark)
          }
        />
      )}

      {pending === null ? null : (
        <BottomSheet
          open
          onClose={() => setPending(null)}
          title={t('mark.replaceTitle')}
          closeLabel={t('common.close')}
        >
          <p className="font-ui text-base">
            {t('mark.replaceBody', {
              distance: showDistance(pending.input.distanceM),
              old:
                existing === undefined ? '?' : showReading(existing.scaleValueMm, scale, separator),
              new: showReading(pending.input.scaleValueMm, scale, separator),
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void save(pending.input, pending.values, pending.mark, true)}>
              {t('mark.replace')}
            </Button>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {t('mark.keep')}
            </Button>
          </div>
        </BottomSheet>
      )}

      {undoError ? (
        <p role="alert" className="font-ui text-base text-danger">
          {t('mark.undoFailed')}
        </p>
      ) : null}
    </section>
  );
}
