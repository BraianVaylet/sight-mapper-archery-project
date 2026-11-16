import { isApiError, newId, useHttp } from '@sight-mapper/client';
import { decimalSeparator } from '@sight-mapper/i18n';
import type { UnitSystem, ValidationIssue } from '@sight-mapper/types';
import {
  BottomSheet,
  Button,
  ErrorState,
  Field,
  InfoAlert,
  NumberField,
  SectionCard,
  Skeleton,
} from '@sight-mapper/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { profileQuery } from '../account/profile.js';
import { fieldError } from '../auth/form-utils.js';
import {
  NUMBER_FIELDS,
  toArrowSetInput,
  toArrowSetPatch,
  toFormValues,
  unitOf,
  type ArrowFormValues,
  type NumberFieldName,
  type TextFieldName,
} from './arrow-form.logic.js';
import { useAfterSave, type AfterSave } from './after-save.js';
import { arrowSetHooks, type ArrowSetResource } from './arrow-sets.js';

const MAIN_TEXT = ['name', 'manufacturer', 'model'] as const;
const MAIN_NUMBERS: readonly NumberFieldName[] = ['spine', 'cutLengthMm', 'gpi'];
const WEIGHTS: readonly NumberFieldName[] = ['pointWeightG', 'extraWeightG', 'totalWeightG'];
const MORE_TEXT = ['vanes', 'vaneColor', 'nock', 'notes'] as const;
const MORE_NUMBERS: readonly NumberFieldName[] = ['vaneCount', 'measuredSpeedMps'];

/** New set of arrows (no `id`) or edit of one. Only the name is required (HU-ARW-01). */
export function ArrowFormScreen({
  id,
  next,
}: {
  id: string | undefined;
  next?: AfterSave | undefined;
}) {
  const { t, translate } = useI18n();
  const detail = arrowSetHooks.useDetail(id);
  const profile = useQuery(profileQuery(useHttp()));
  const system = profile.data?.unitSystem ?? 'metric';

  // The form waits for the profile: fields that change unit under the archer's fingers are worse
  // than a short skeleton.
  if ((id !== undefined && detail.isPending) || profile.isPending) {
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
  return (
    <ArrowForm
      key={`${id ?? 'new'}-${system}-${detail.data?.version ?? 0}`}
      set={detail.data}
      system={system}
      next={next}
    />
  );
}

function ArrowForm({
  set,
  system,
  next,
}: {
  set: ArrowSetResource | undefined;
  system: UnitSystem;
  next: AfterSave | undefined;
}) {
  const { t, locale, translate } = useI18n();
  const navigate = useNavigate();
  const afterSave = useAfterSave('arrowSet', '/arrows', next);
  const [newSetId] = useState(() => newId());
  const [values, setValues] = useState<ArrowFormValues>(() =>
    toFormValues(set, system, decimalSeparator(locale)),
  );
  const [errors, setErrors] = useState<Partial<Record<string, ValidationIssue>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = arrowSetHooks.useCreate();
  const update = arrowSetHooks.useUpdate();
  const remove = arrowSetHooks.useRemove();
  const action = arrowSetHooks.useAction();
  const failure = create.error ?? update.error ?? remove.error ?? action.error;

  const set_ = (name: keyof ArrowFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const errorOf = (name: string) => {
    const issue = errors[name];
    return issue === undefined ? undefined : fieldError([issue], translate);
  };

  async function submit() {
    const result = toArrowSetInput(values, system, set?.id ?? newSetId);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      if (set === undefined) await create.create(result.input);
      else await update.mutateAsync({ id: set.id, patch: toArrowSetPatch(result) });
      await afterSave(set === undefined ? newSetId : undefined);
    } catch {
      // Shown from the mutation's error below.
    }
  }

  const textField = (name: TextFieldName) => (
    <Field
      key={name}
      label={t(`arrows.form.${name}`)}
      value={values[name]}
      onChange={(event) => set_(name)(event.target.value)}
      error={errorOf(name)}
    />
  );
  const numberField = (name: NumberFieldName) => {
    const field = NUMBER_FIELDS.find((candidate) => candidate.name === name);
    return (
      <NumberField
        key={name}
        label={t(`arrows.form.${name}`)}
        unit={field === undefined ? undefined : unitOf(field.quantity, system) || undefined}
        value={values[name]}
        onChange={(event) => set_(name)(event.target.value)}
        error={errorOf(name)}
      />
    );
  };

  const busy = create.isPending || update.isPending;
  const blockedDelete = isApiError(remove.error) && remove.error.code === 'SM-ARW-409-001';
  const inUse = set?.usage !== undefined && set.usage.setups > 0;

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h1 className="font-display text-2xl">
        {set === undefined ? t('arrows.list.new') : t('arrows.form.editTitle')}
      </h1>

      {failure === null ? null : (
        <InfoAlert variant="danger">{describeError(translate, failure).text}</InfoAlert>
      )}
      {set?.usage === undefined ? null : (
        <InfoAlert variant="info">{t('arrows.form.usage', set.usage)}</InfoAlert>
      )}

      <SectionCard title={t('arrows.form.sectionSet')}>
        <p className="font-ui text-sm text-muted">{t('arrows.form.hint')}</p>
        {MAIN_TEXT.map(textField)}
        {MAIN_NUMBERS.map(numberField)}
        {WEIGHTS.map(numberField)}
      </SectionCard>

      <details className="rounded-md border border-border bg-surface p-4">
        <summary className="cursor-pointer font-ui text-sm font-semibold tracking-widest uppercase">
          {t('arrows.form.sectionMore')}
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          {MORE_TEXT.slice(0, 3).map(textField)}
          {MORE_NUMBERS.map(numberField)}
          {textField('notes')}
        </div>
      </details>

      <Button type="submit" disabled={busy}>
        {busy ? t('common.loading') : t('common.save')}
      </Button>

      {set === undefined ? null : (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              void action
                .run(set.id, set.status === 'archived' ? 'unarchive' : 'archive')
                .then(() => navigate({ to: '/arrows' }))
                .catch(() => undefined)
            }
          >
            {set.status === 'archived' ? t('arrows.list.unarchive') : t('arrows.list.archive')}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            {t('arrows.form.delete')}
          </Button>
        </div>
      )}

      {set === undefined ? null : (
        <BottomSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={t('arrows.form.deleteTitle')}
          closeLabel={t('common.close')}
        >
          <p className="font-ui text-base">
            {inUse
              ? t('arrows.form.usage', set.usage ?? { setups: 0, marks: 0 })
              : t('arrows.form.deleteBody')}
          </p>
          {blockedDelete ? (
            <InfoAlert variant="danger">{describeError(translate, remove.error).text}</InfoAlert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {blockedDelete ? (
              <Button
                onClick={() =>
                  void action
                    .run(set.id, 'archive')
                    .then(() => navigate({ to: '/arrows' }))
                    .catch(() => undefined)
                }
              >
                {t('arrows.form.archiveInstead')}
              </Button>
            ) : (
              <Button
                disabled={remove.isPending}
                onClick={() =>
                  void remove
                    .mutateAsync({ id: set.id })
                    .then(() => navigate({ to: '/arrows' }))
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
