import { isApiError, newId, useHttp } from '@sight-mapper/client';
import { formatReading } from '@sight-mapper/domain';
import { decimalSeparator, formatNumber } from '@sight-mapper/i18n';
import type { ScaleChangeStrategy, ValidationIssue } from '@sight-mapper/types';
import {
  BottomSheet,
  Button,
  ErrorState,
  Field,
  InfoAlert,
  NumberField,
  SectionCard,
  Segmented,
  Select,
  Skeleton,
} from '@sight-mapper/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { describeError } from '../../app/errors.js';
import { profileQuery, useUnits } from '../account/profile.js';
import { useI18n } from '../../app/i18n.js';
import { fieldError } from '../auth/form-utils.js';
import { Ruler } from '../sight/ruler.js';
import {
  hasFixedSize,
  previewScale,
  toFormValues,
  toSightInput,
  toSightPatch,
  travelMm,
  withWindageCopy,
  type ScaleFormValues,
  type SightFormValues,
} from './sight-form.logic.js';
import { useAfterSave, type AfterSave } from './after-save.js';
import { sightHooks, type SightResource } from './sights.js';

const NAME_FIELDS = ['nickname', 'manufacturer', 'model'] as const;

type ScaleFieldsProps = {
  block: ScaleFormValues;
  onChange: (name: keyof ScaleFormValues, value: string) => void;
  errorOf: (name: string) => string | undefined;
  /** Prefix of the error keys of this block: `''` or `'windage.'`. */
  errorPrefix: string;
  label: (
    name: 'unit' | 'min' | 'max' | 'resolution' | 'unitSizeMm' | 'lengthMm' | 'direction',
  ) => string;
  directions: readonly { value: string; label: string }[];
};

/** The fields of one scale: the vertical one and the horizontal one share them (F1-42). */
function ScaleFields({
  block,
  onChange,
  errorOf,
  errorPrefix,
  label,
  directions,
}: ScaleFieldsProps) {
  const { t } = useI18n();
  const fixed = hasFixedSize(block.unit);
  const number = (name: 'min' | 'max' | 'resolution') => (
    <NumberField
      label={label(name)}
      value={block[name]}
      onChange={(event) => onChange(name, event.target.value)}
      error={errorOf(errorPrefix + name)}
    />
  );
  return (
    <>
      <Select
        label={label('unit')}
        value={block.unit}
        onChange={(event) => onChange('unit', event.target.value)}
        options={[
          { value: 'mm', label: t('sights.form.unitMm') },
          { value: 'cm', label: t('sights.form.unitCm') },
          { value: 'in', label: t('sights.form.unitIn') },
          { value: 'click', label: t('sights.form.unitClick') },
          { value: 'custom', label: t('sights.form.unitCustom') },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {number('min')}
        {number('max')}
        {number('resolution')}
      </div>
      {fixed ? null : (
        <>
          <NumberField
            label={label('unitSizeMm')}
            unit="mm"
            hint={t('sights.form.unitSizeHint')}
            value={block.unitSizeMm}
            onChange={(event) => onChange('unitSizeMm', event.target.value)}
            error={errorOf(errorPrefix + 'unitSizeMm')}
          />
          <NumberField
            label={label('lengthMm')}
            unit="mm"
            value={block.lengthMm}
            onChange={(event) => onChange('lengthMm', event.target.value)}
            error={errorOf(errorPrefix + 'lengthMm')}
          />
        </>
      )}
      <Segmented
        label={label('direction')}
        value={
          directions.some((d) => d.value === block.direction)
            ? block.direction
            : (directions[0]?.value ?? '')
        }
        onChange={(value) => onChange('direction', value)}
        options={directions}
      />
    </>
  );
}

/** New sight (no `id`) or edit of one: scale with preview, archive and protected delete. */
export function SightFormScreen({
  id,
  next,
}: {
  id: string | undefined;
  next?: AfterSave | undefined;
}) {
  const { t, translate } = useI18n();
  const detail = sightHooks.useDetail(id);
  const profile = useQuery(profileQuery(useHttp()));

  // A new sight waits for the profile too: its scale starts on the unit of the sight section, and
  // a unit that flips under the archer's fingers is worse than a short skeleton.
  if ((id !== undefined && detail.isPending) || (id === undefined && profile.isPending)) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (id !== undefined && detail.isError) {
    return (
      <ErrorState
        title={t('app.routeError.title')}
        description={describeError(translate, detail.error).text}
        retryLabel={t('common.retry')}
        onRetry={() => void detail.refetch()}
      />
    );
  }
  // `key` rebuilds the form when a newer copy of the sight arrives.
  return (
    <SightForm
      key={`${id ?? 'new'}-${detail.data?.version ?? 0}`}
      sight={detail.data}
      next={next}
    />
  );
}

function SightForm({
  sight,
  next,
}: {
  sight: SightResource | undefined;
  next: AfterSave | undefined;
}) {
  const { t, locale, translate } = useI18n();
  const units = useUnits();
  // Error params with a distance follow the marks section (docs/errors.md §2).
  const system = units.marks;
  const navigate = useNavigate();
  const afterSave = useAfterSave('sight', '/sights', next);
  const separator = decimalSeparator(locale);
  const [newSightId] = useState(() => newId());
  const [values, setValues] = useState<SightFormValues>(() =>
    toFormValues(sight, separator, units.sight === 'imperial' ? 'in' : 'mm'),
  );
  // A new sight's horizontal scale follows the vertical one until the archer touches it (F1-42).
  const [windageTouched, setWindageTouched] = useState(sight !== undefined);
  const legacyWithoutWindage = sight !== undefined && sight.windageScale === null;
  const [errors, setErrors] = useState<Partial<Record<string, ValidationIssue>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [needStrategy, setNeedStrategy] = useState(false);

  const create = sightHooks.useCreate();
  const update = sightHooks.useUpdate();
  const remove = sightHooks.useRemove();
  const action = sightHooks.useAction();
  const failure = create.error ?? update.error ?? remove.error ?? action.error;

  const set = (name: Exclude<keyof SightFormValues, 'windage'>) => (value: string) =>
    setValues((current) => {
      const next = { ...current, [name]: value };
      return windageTouched ? next : withWindageCopy(next);
    });
  const setWindage = (name: keyof ScaleFormValues, value: string) => {
    setWindageTouched(true);
    setValues((current) => ({ ...current, windage: { ...current.windage, [name]: value } }));
  };
  const errorOf = (name: string) => {
    const issue = errors[name];
    return issue === undefined ? undefined : fieldError([issue], translate);
  };

  const scale = useMemo(() => previewScale(values), [values]);
  const travel = travelMm(values);
  const fixed = hasFixedSize(values.unit);
  const verticalLabel = (name: Parameters<ScaleFieldsProps['label']>[0]) =>
    t(`sights.form.${name}`);
  const windageLabel = (name: Parameters<ScaleFieldsProps['label']>[0]) =>
    t(`sights.form.windage.${name}`);

  async function submit(strategy?: ScaleChangeStrategy) {
    const result = toSightInput(values, sight?.id ?? newSightId, {
      requireWindage: sight === undefined,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      if (sight === undefined) {
        await create.create(result.input);
      } else {
        await update.mutateAsync({
          id: sight.id,
          patch: {
            ...toSightPatch(result),
            // One answer covers both scales: the archer chooses what to keep, not which axis.
            ...(strategy === undefined
              ? {}
              : { scaleChangeStrategy: strategy, windageScaleChangeStrategy: strategy }),
          },
        });
      }
      await afterSave(sight === undefined ? result.input.id : undefined);
    } catch (error) {
      // HU-SGT-02: the scale changed meaning under existing marks, so ask what to keep.
      if (isApiError(error) && error.code === 'SM-SGT-409-003') setNeedStrategy(true);
    }
  }

  const busy = create.isPending || update.isPending;
  const strategyError = isApiError(update.error) && update.error.code === 'SM-SGT-409-003';
  const blockedDelete = isApiError(remove.error) && remove.error.code === 'SM-SGT-409-001';
  const inUse = sight?.usage !== undefined && sight.usage.setups > 0;

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h1 className="font-display text-3xl font-bold">
        {sight === undefined ? t('sights.list.new') : t('sights.form.editTitle')}
      </h1>

      {failure === null || strategyError ? null : (
        <InfoAlert variant="danger">
          {describeError(translate, failure, { system, locale }).text}
        </InfoAlert>
      )}
      {sight?.usage === undefined ? null : (
        <InfoAlert variant="info">{t('sights.form.usage', sight.usage)}</InfoAlert>
      )}

      <SectionCard index="01" title={t('sights.form.sectionSight')}>
        {NAME_FIELDS.map((name) => (
          <Field
            key={name}
            label={t(`sights.form.${name}`)}
            value={values[name]}
            onChange={(event) => set(name)(event.target.value)}
            error={errorOf(name)}
          />
        ))}
        <Select
          label={t('sights.form.pinType')}
          value={values.pinType}
          onChange={(event) => set('pinType')(event.target.value)}
          options={[
            { value: 'monopin', label: t('sights.form.pinMonopin') },
            { value: 'dualpin', label: t('sights.form.pinDualpin') },
            { value: 'multipin', label: t('sights.form.pinMultipin') },
          ]}
          error={errorOf('pinType')}
        />
      </SectionCard>

      <SectionCard index="02" title={t('sights.form.sectionScale')}>
        <ScaleFields
          block={values}
          onChange={(name, value) => set(name)(value)}
          errorOf={errorOf}
          errorPrefix=""
          label={verticalLabel}
          directions={[
            { value: 'down', label: t('sights.form.dirDown') },
            { value: 'up', label: t('sights.form.dirUp') },
          ]}
        />
        {travel === undefined ? null : (
          <p className="font-ui text-base">
            {t('sights.form.travel', {
              travel: formatNumber(travel, locale, Number.isInteger(travel) ? 0 : 1),
            })}
          </p>
        )}
        {fixed || values.unitSizeMm.trim() !== '' || values.lengthMm.trim() !== '' ? null : (
          <InfoAlert variant="warning">{t('sights.form.noPhysicalSize')}</InfoAlert>
        )}
        {scale === undefined ? null : (
          <div className="flex flex-col gap-2">
            <h3 className="font-ui text-sm text-muted">{t('sights.form.preview')}</h3>
            <Ruler
              scale={scale}
              marks={[]}
              lengthPx={320}
              label={t('sights.form.previewLabel')}
              formatValue={(value) => formatReading(value, scale, separator)}
            />
          </div>
        )}
      </SectionCard>

      <SectionCard index="03" title={t('sights.form.windage.title')}>
        {legacyWithoutWindage ? (
          <InfoAlert variant="info">{t('sights.form.windage.missing')}</InfoAlert>
        ) : null}
        {sight === undefined && !windageTouched ? (
          <p className="font-ui text-sm text-muted">{t('sights.form.windage.copied')}</p>
        ) : null}
        <ScaleFields
          block={values.windage}
          onChange={setWindage}
          errorOf={errorOf}
          errorPrefix="windage."
          label={windageLabel}
          directions={[
            { value: 'right', label: t('sights.form.windage.dirRight') },
            { value: 'left', label: t('sights.form.windage.dirLeft') },
          ]}
        />
      </SectionCard>

      <SectionCard index="04" title={t('sights.form.sectionNotes')}>
        <Field
          label={t('sights.form.notes')}
          value={values.notes}
          onChange={(event) => set('notes')(event.target.value)}
          error={errorOf('notes')}
        />
      </SectionCard>

      <Button type="submit" disabled={busy}>
        {busy ? t('common.loading') : t('common.save')}
      </Button>

      {sight === undefined ? null : (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              void action
                .run(sight.id, sight.status === 'archived' ? 'unarchive' : 'archive')
                .then(() => navigate({ to: '/sights' }))
                .catch(() => undefined)
            }
          >
            {sight.status === 'archived' ? t('sights.list.unarchive') : t('sights.list.archive')}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            {t('sights.form.delete')}
          </Button>
        </div>
      )}

      <BottomSheet
        open={needStrategy}
        onClose={() => setNeedStrategy(false)}
        title={t('sights.form.strategyTitle')}
        closeLabel={t('common.close')}
      >
        <p className="font-ui text-base">
          {t('sights.form.strategyBody', {
            marks: isApiError(update.error) ? Number(update.error.params['marks'] ?? 0) : 0,
          })}
        </p>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              setNeedStrategy(false);
              void submit('keepReadings');
            }}
          >
            {t('sights.form.keepReadings')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setNeedStrategy(false);
              void submit('keepPositions');
            }}
          >
            {t('sights.form.keepPositions')}
          </Button>
        </div>
      </BottomSheet>

      {sight === undefined ? null : (
        <BottomSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={t('sights.form.deleteTitle')}
          closeLabel={t('common.close')}
        >
          <p className="font-ui text-base">
            {inUse
              ? t('sights.form.usage', sight.usage ?? { setups: 0, marks: 0 })
              : t('sights.form.deleteBody')}
          </p>
          {blockedDelete ? (
            <InfoAlert variant="danger">
              {describeError(translate, remove.error, { system, locale }).text}
            </InfoAlert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {blockedDelete ? (
              <Button
                onClick={() =>
                  void action
                    .run(sight.id, 'archive')
                    .then(() => navigate({ to: '/sights' }))
                    .catch(() => undefined)
                }
              >
                {t('sights.form.archiveInstead')}
              </Button>
            ) : (
              <Button
                disabled={remove.isPending}
                onClick={() =>
                  void remove
                    .mutateAsync({ id: sight.id })
                    .then(() => navigate({ to: '/sights' }))
                    .catch(() => undefined)
                }
              >
                {t('common.delete')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </BottomSheet>
      )}
    </form>
  );
}
