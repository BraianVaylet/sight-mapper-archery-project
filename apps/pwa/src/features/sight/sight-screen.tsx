import { isApiError } from '@sight-mapper/client';
import { formatReading } from '@sight-mapper/domain';
import { formatNumber } from '@sight-mapper/i18n';
import type { CreateMark, Mark, SetupView } from '@sight-mapper/schemas';
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  InfoAlert,
  SectionCard,
  Select,
  Skeleton,
  StatusBadge,
  Toast,
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

const TOOL_CLASS =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border border-border px-3 font-ui text-base';

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
      <button
        type="button"
        aria-disabled="true"
        className={`${TOOL_CLASS} cursor-not-allowed text-muted`}
      >
        <span>{t('sight.distances')}</span>
        <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted">
          {`${count}/${CALC_MIN_MARKS_INTERPOLATE}`}
        </span>
      </button>
    );
  }
  return (
    <Link
      to="/setups/$setupId/distances"
      params={{ setupId }}
      search={arrowSetId === undefined ? {} : { arrowSet: arrowSetId }}
      className={`${TOOL_CLASS} text-text`}
    >
      {t('sight.distances')}
    </Link>
  );
}

/** A tool that is not available yet: visible, announced as unavailable, and goes nowhere (RF-X-07). */
function ToolButton({ label, badge }: { label: string; badge: string }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      className={`${TOOL_CLASS} cursor-not-allowed text-muted`}
    >
      <span>{label}</span>
      <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted">
        {badge}
      </span>
    </button>
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
  const { system, separator, arrowId, marksQuery, marks, scale, analysis } = useSightData(
    setup,
    arrowParam,
  );
  const actions = useMarkActions(setup.id, arrowId ?? '');

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [undoError, setUndoError] = useState(false);

  const unit = t(system === 'metric' ? 'sight.distanceUnitMetric' : 'sight.distanceUnitImperial');
  const showDistance = (m: number) => formatDistance(m, system, locale, unit);
  const readingText = (r: Reading) => (r.ok ? formatReading(r.reading, scale, separator) : '—');

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

  return (
    <section className="flex flex-col gap-4 pb-24">
      <div className="flex flex-col gap-1">
        <Link to="/" className="font-ui text-base text-info underline underline-offset-2">
          ‹ {t('sight.back')}
        </Link>
        <h1 className="font-display text-2xl">{nameOf(setup)}</h1>
        <p className="font-ui text-base text-muted">
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

      <QuickAccessToggle setupId={setup.id} arrowSetId={arrowId} />

      <div role="group" aria-label={t('sight.tools')} className="flex flex-wrap gap-2">
        <ToolButton label={t('sight.wind')} badge={t('sight.soon')} />
        <ToolButton label={t('sight.weather')} badge={t('sight.soon')} />
        <DistancesTool setupId={setup.id} arrowSetId={arrowId} count={analysis.count} />
        {progress.ready ? (
          <Link
            to="/setups/$setupId/doctor"
            params={{ setupId: setup.id }}
            search={arrowId === undefined ? {} : { arrowSet: arrowId }}
            className={`${TOOL_CLASS} text-text`}
          >
            {t('sight.doctor')}
          </Link>
        ) : (
          <ToolButton
            label={t('sight.doctor')}
            badge={t('sight.doctorNeeds', { have: progress.have, need: progress.need })}
          />
        )}
        {marks.length > 0 ? (
          <Link
            to="/setups/$setupId/print"
            params={{ setupId: setup.id }}
            search={arrowId === undefined ? {} : { arrowSet: arrowId }}
            className={`${TOOL_CLASS} text-text`}
          >
            {t('sight.print')}
          </Link>
        ) : (
          <ToolButton label={t('sight.print')} badge="0/1" />
        )}
      </div>

      <div
        aria-live="polite"
        className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4"
      >
        {selectedM === undefined || selected === undefined ? (
          <p className="font-ui text-base text-muted">{t('sight.readoutPick')}</p>
        ) : (
          <>
            <p className="font-ui text-sm text-muted">
              {t('sight.readout', { distance: showDistance(selectedM) })}
            </p>
            <p className="font-display text-4xl tabular-nums">
              {selected.ok && selected.kind !== 'measured' ? '≈ ' : ''}
              {readingText(selected)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ReadingBadge
                reading={selected}
                suspect={selectedMark !== undefined && analysis.suspectIds.has(selectedMark.id)}
                inconsistent={
                  selectedMark !== undefined && analysis.inconsistentIds.has(selectedMark.id)
                }
              />
              {selected.ok && selected.lowConfidence ? (
                <span className="text-sm text-warning">{t('sight.lowConfidence')}</span>
              ) : null}
              {selected.ok && selected.outOfScale ? (
                <span className="text-sm text-warning">{t('sight.outOfScale')}</span>
              ) : null}
              {!selected.ok ? (
                <span className="text-sm text-muted">
                  {calcFailureText(translate, selected, units)}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>

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
              <ul className="font-ui text-base">
                <li>
                  <span aria-hidden="true">
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
        <div className="grid items-start gap-4 md:grid-cols-2">
          <SectionCard title={t('sight.rulerLabel')} className="min-w-0">
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
            <p className="flex flex-wrap gap-4 font-ui text-sm" aria-label={t('sight.legend')}>
              <span>
                {GLYPH.filled}
                {t('sight.registered')}
              </span>
              <span>
                {GLYPH.estimate}
                {t('sight.calculated')}
              </span>
            </p>
          </SectionCard>

          <SectionCard title={t('sight.tableTitle')} count={marks.length} className="min-w-0">
            <table className="w-full border-collapse font-ui text-base" onKeyDown={onTableKey}>
              <caption className="sr-only">{t('sight.tableCaption')}</caption>
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
                  <th scope="col" className="py-1">
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
                      className={`border-t border-border ${isSelected ? 'bg-sunken' : ''}`}
                    >
                      <th scope="row" className="py-1 pr-3 text-left font-medium tabular-nums">
                        <button
                          type="button"
                          aria-label={t('sight.selectMark', {
                            distance: showDistance(m.distanceM),
                          })}
                          aria-current={isSelected ? 'true' : undefined}
                          style={{ minHeight: 44, minWidth: 44 }}
                          className="text-left underline-offset-2 hover:underline"
                          onClick={() => go({ d: m.distanceM })}
                        >
                          {showDistance(m.distanceM)}
                        </button>
                      </th>
                      <td className="py-1 pr-3 tabular-nums">{readingText(reading)}</td>
                      <td className="py-1">
                        <ReadingBadge
                          reading={reading}
                          suspect={analysis.suspectIds.has(m.id)}
                          inconsistent={analysis.inconsistentIds.has(m.id)}
                        />
                      </td>
                      <td className="py-1 text-right">
                        <Button
                          variant="link"
                          aria-label={t('sight.editMark', { distance: showDistance(m.distanceM) })}
                          onClick={() => setSheet({ mode: 'edit', mark: m })}
                        >
                          {t('setups.home.edit')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}

      {analysis.tier === 'none' && marks.length > 0 ? (
        <InfoAlert variant="info">{t('sight.needs', { need: 2, count: marks.length })}</InfoAlert>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="min-w-0 truncate font-ui text-sm uppercase tracking-widest text-muted">
            {t('sight.statusBar')}
            {selectedM === undefined || selected === undefined
              ? ''
              : ` · ${showDistance(selectedM)} · ${readingText(selected)}`}
          </p>
          <Button onClick={() => setSheet({ mode: 'new' })} disabled={arrowId === undefined}>
            {t('sight.add')}
          </Button>
        </div>
      </div>

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
      {toast === null ? null : (
        <Toast
          key={toast.message}
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
      )}
    </section>
  );
}
