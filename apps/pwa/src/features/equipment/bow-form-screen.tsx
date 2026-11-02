import { isApiError, newId, useHttp } from '@sight-mapper/client';
import { decimalSeparator } from '@sight-mapper/i18n';
import {
  BottomSheet,
  Button,
  ErrorState,
  Field,
  InfoAlert,
  NumberField,
  SectionCard,
  Select,
  Skeleton,
} from '@sight-mapper/ui';
import type { ValidationIssue } from '@sight-mapper/types';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { profileQuery } from '../account/profile.js';
import { fieldError } from '../auth/form-utils.js';
import {
  NUMBER_FIELDS,
  toBowInput,
  toBowPatch,
  toFormValues,
  unitOf,
  type BowFormValues,
} from './bow-form.logic.js';
import { bowHooks, type BowResource } from './bows.js';

const NAME_FIELDS = ['nickname', 'manufacturer', 'model'] as const;

/** New bow (no `id`) or edit of one. Shows what uses it, and archives or deletes it. */
export function BowFormScreen({ id }: { id: string | undefined }) {
  const { t, translate } = useI18n();
  const detail = bowHooks.useDetail(id);
  const profile = useQuery(profileQuery(useHttp()));
  // The units come from the profile. The form waits for it: fields that change unit under the
  // archer's fingers (and drop what they typed) are worse than a short skeleton.
  const system = profile.data?.unitSystem ?? 'metric';

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

  // `key` rebuilds the form when the bow or the system changes, so the fields never show stale units.
  return (
    <BowForm
      key={`${id ?? 'new'}-${system}-${detail.data?.version ?? 0}`}
      bow={detail.data}
      system={system}
    />
  );
}

function BowForm({ bow, system }: { bow: BowResource | undefined; system: 'metric' | 'imperial' }) {
  const { t, locale, translate } = useI18n();
  const navigate = useNavigate();
  const separator = decimalSeparator(locale);
  const [newBowId] = useState(() => newId());
  const [values, setValues] = useState<BowFormValues>(() => toFormValues(bow, system, separator));
  const [errors, setErrors] = useState<Partial<Record<string, ValidationIssue>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = bowHooks.useCreate();
  const update = bowHooks.useUpdate();
  const remove = bowHooks.useRemove();
  const action = bowHooks.useAction();
  const failure = create.error ?? update.error ?? remove.error ?? action.error;

  const set = (name: keyof BowFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function submit() {
    const result = toBowInput(values, system, bow?.id ?? newBowId);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      if (bow === undefined) {
        await create.create(result.input);
      } else {
        await update.mutateAsync({ id: bow.id, patch: toBowPatch(result) });
      }
      await navigate({ to: '/bows' });
    } catch {
      // Shown from the mutation's error below.
    }
  }

  const errorOf = (name: string) => {
    const issue = errors[name];
    return issue === undefined ? undefined : fieldError([issue], translate);
  };
  const busy = create.isPending || update.isPending;
  const inUse = bow?.usage !== undefined && bow.usage.setups > 0;
  const blockedDelete = isApiError(remove.error) && remove.error.code === 'SM-BOW-409-001';

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h1 className="font-display text-2xl">
        {bow === undefined ? t('bows.list.new') : t('bows.form.editTitle')}
      </h1>

      {failure === null ? null : (
        <InfoAlert variant="danger">{describeError(translate, failure).text}</InfoAlert>
      )}
      {bow?.usage === undefined ? null : (
        <InfoAlert variant="info">{t('bows.form.usage', bow.usage)}</InfoAlert>
      )}

      <SectionCard title={t('bows.form.sectionBow')}>
        {NAME_FIELDS.map((name) => (
          <Field
            key={name}
            label={t(`bows.form.${name}`)}
            value={values[name]}
            onChange={(event) => set(name)(event.target.value)}
            error={errorOf(name)}
          />
        ))}
        <Select
          label={t('bows.form.camType')}
          value={values.camType}
          onChange={(event) => set('camType')(event.target.value)}
          options={[
            { value: '', label: t('bows.form.camNone') },
            { value: 'single', label: t('bows.form.camSingle') },
            { value: 'hybrid', label: t('bows.form.camHybrid') },
            { value: 'binary', label: t('bows.form.camBinary') },
          ]}
          error={errorOf('camType')}
        />
      </SectionCard>

      <SectionCard title={t('bows.form.sectionDimensions')}>
        {NUMBER_FIELDS.map((field) => (
          <NumberField
            key={field.name}
            label={t(`bows.form.${field.name}`)}
            unit={unitOf(field.quantity, system)}
            value={values[field.name]}
            onChange={(event) => set(field.name)(event.target.value)}
            error={errorOf(field.name)}
          />
        ))}
      </SectionCard>

      <SectionCard title={t('bows.form.sectionNotes')}>
        <Field
          label={t('bows.form.rest')}
          value={values.rest}
          onChange={(event) => set('rest')(event.target.value)}
          error={errorOf('rest')}
        />
        <Field
          label={t('bows.form.notes')}
          value={values.notes}
          onChange={(event) => set('notes')(event.target.value)}
          error={errorOf('notes')}
        />
      </SectionCard>

      <Button type="submit" disabled={busy}>
        {busy ? t('common.loading') : t('common.save')}
      </Button>

      {bow === undefined ? null : (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              void action
                .run(bow.id, bow.status === 'archived' ? 'unarchive' : 'archive')
                .then(() => navigate({ to: '/bows' }))
                .catch(() => undefined)
            }
          >
            {bow.status === 'archived' ? t('bows.list.unarchive') : t('bows.list.archive')}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            {t('bows.form.delete')}
          </Button>
        </div>
      )}

      {bow === undefined ? null : (
        <BottomSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={t('bows.form.deleteTitle')}
          closeLabel={t('common.close')}
        >
          <p className="font-ui text-base">
            {inUse
              ? t('bows.form.usage', bow.usage ?? { setups: 0, marks: 0 })
              : t('bows.form.deleteBody')}
          </p>
          {blockedDelete ? (
            <InfoAlert variant="danger">{describeError(translate, remove.error).text}</InfoAlert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {blockedDelete ? (
              <Button
                onClick={() =>
                  void action
                    .run(bow.id, 'archive')
                    .then(() => navigate({ to: '/bows' }))
                    .catch(() => undefined)
                }
              >
                {t('bows.form.archiveInstead')}
              </Button>
            ) : (
              <Button
                disabled={remove.isPending}
                onClick={() =>
                  void remove
                    .mutateAsync({ id: bow.id })
                    .then(() => navigate({ to: '/bows' }))
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
