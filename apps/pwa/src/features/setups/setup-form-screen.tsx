import { isApiError, newId, useHttp } from '@sight-mapper/client';
import { setupView, type SetupView } from '@sight-mapper/schemas';
import {
  BottomSheet,
  Button,
  ErrorState,
  Field,
  InfoAlert,
  SectionCard,
  Select,
  Skeleton,
} from '@sight-mapper/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { arrowSetHooks } from '../equipment/arrow-sets.js';
import { bowHooks } from '../equipment/bows.js';
import { componentName } from '../equipment/names.js';
import { sightHooks } from '../equipment/sights.js';
import { setupHooks, useSendToTrash } from './setups.js';
import { useSetupName } from './home-screen.js';

/** New setup (no `id`) or edit of one (HU-STP-01). The bow and the sight are chosen once. */
export function SetupFormScreen({ id }: { id: string | undefined }) {
  const { t, translate } = useI18n();
  const detail = setupHooks.useDetail(id);

  if (id !== undefined && detail.isPending) {
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
        title={t('setups.form.loadError')}
        description={describeError(translate, detail.error).text}
        retryLabel={t('common.retry')}
        onRetry={() => void detail.refetch()}
      />
    );
  }
  return <SetupForm key={`${id ?? 'new'}-${detail.data?.version ?? 0}`} setup={detail.data} />;
}

type Choice = { id: string; label: string };

function ArrowChoices({
  choices,
  selected,
  onToggle,
  error,
}: {
  choices: readonly Choice[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  error: string | undefined;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby="arrows-hint">
      <legend className="font-ui text-sm font-semibold">{t('setups.form.arrows')}</legend>
      <p id="arrows-hint" className="font-ui text-sm text-muted">
        {t('setups.form.arrowsHint')}
      </p>
      {choices.map((choice) => (
        <label
          key={choice.id}
          style={{ minHeight: 44 }}
          className="flex items-center gap-3 rounded-sm border border-border px-3 font-ui text-base"
        >
          <input
            type="checkbox"
            checked={selected.has(choice.id)}
            onChange={() => onToggle(choice.id)}
            className="h-5 w-5 accent-[var(--sm-accent)]"
          />
          {choice.label}
        </label>
      ))}
      {error === undefined ? null : (
        <p role="alert" className="font-ui text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function SetupForm({ setup }: { setup: SetupView | undefined }) {
  const { t, translate } = useI18n();
  const http = useHttp();
  const navigate = useNavigate();
  const nameOf = useSetupName();
  const [newSetupId] = useState(() => newId());
  const [name, setName] = useState(setup?.name ?? '');
  const [bowId, setBowId] = useState(setup?.bowId ?? '');
  const [sightId, setSightId] = useState(setup?.sightId ?? '');
  const [arrowIds, setArrowIds] = useState<ReadonlySet<string>>(new Set(setup?.arrowSetIds ?? []));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bows = bowHooks.useList({ status: 'active' });
  const sights = sightHooks.useList({ status: 'active' });
  const arrows = arrowSetHooks.useList({ status: 'active' });
  const create = setupHooks.useCreate();
  const update = setupHooks.useUpdate();
  const action = setupHooks.useAction();
  const trash = useSendToTrash();
  const failure = create.error ?? update.error ?? action.error ?? trash.error;
  const taken =
    isApiError(create.error) && create.error.code === 'SM-STP-409-001' ? create.error : undefined;
  // These two are shown where they belong: on the pair offer, and on the select that failed.
  const shownInPlace =
    taken !== undefined || (isApiError(failure) && failure.code === 'SM-STP-422-001');

  const toggle = (arrowId: string) =>
    setArrowIds((current) => {
      const next = new Set(current);
      if (next.has(arrowId)) next.delete(arrowId);
      else next.add(arrowId);
      return next;
    });

  // The active sets, plus any archived set the setup still carries (it can be kept or dropped).
  const arrowChoices: Choice[] = [
    ...(arrows.data?.items ?? []).map((a) => ({ id: a.id, label: a.name })),
    ...(setup?.arrowSets ?? [])
      .filter((a) => !(arrows.data?.items ?? []).some((active) => active.id === a.id))
      .map((a) => ({ id: a.id, label: a.name })),
  ];

  async function submit() {
    const chosen = [...arrowIds];
    const missing: Record<string, string> = {};
    if (setup === undefined && bowId === '') missing['bow'] = t('validation.required');
    if (setup === undefined && sightId === '') missing['sight'] = t('validation.required');
    if (chosen.length === 0) missing['arrows'] = t('validation.required');
    setProblems(missing);
    if (Object.keys(missing).length > 0) return;

    const trimmed = name.trim();
    try {
      if (setup === undefined) {
        await create.create({
          id: newSetupId,
          bowId,
          sightId,
          arrowSetIds: chosen,
          isFavorite: false,
          ...(trimmed === '' ? {} : { name: trimmed }),
        });
        await navigate({ to: '/setups/$setupId', params: { setupId: newSetupId } });
      } else {
        await update.mutateAsync({
          id: setup.id,
          patch: { name: trimmed === '' ? null : trimmed, arrowSetIds: chosen },
        });
        await navigate({ to: '/' });
      }
    } catch (error) {
      // A component that is no longer available names itself: mark that select.
      if (isApiError(error) && error.code === 'SM-STP-422-001') {
        const kind = String(error.params['kind']);
        setProblems({
          [kind === 'arrowSet' ? 'arrows' : kind]: describeError(translate, error).text,
        });
      }
    }
  }

  /** HU-STP-01: the pair is taken, so these arrows go to the setup that already has it. */
  async function addToExisting(existingId: string) {
    const existing = await http.get(`/setups/${encodeURIComponent(existingId)}`, {
      schema: setupView,
    });
    const merged = [...new Set([...existing.arrowSetIds, ...arrowIds])];
    await update.mutateAsync({ id: existingId, patch: { arrowSetIds: merged } });
    await navigate({ to: '/setups/$setupId', params: { setupId: existingId } });
  }

  const busy = create.isPending || update.isPending;
  const nothingToChoose = (list: { data: { items: unknown[] } | undefined }) =>
    list.data !== undefined && list.data.items.length === 0;

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
        {setup === undefined ? t('setups.form.newTitle') : t('setups.form.editTitle')}
      </h1>

      {failure === null || shownInPlace ? null : (
        <InfoAlert variant="danger">{describeError(translate, failure).text}</InfoAlert>
      )}
      {taken === undefined ? null : (
        <InfoAlert variant="warning">
          <p>{t('setups.form.existing')}</p>
          <Button
            variant="link"
            onClick={() =>
              void addToExisting(String(taken.params['existingSetupId'])).catch(() => undefined)
            }
          >
            {t('setups.form.addToExisting')}
          </Button>
        </InfoAlert>
      )}

      <SectionCard title={setup === undefined ? t('setups.form.newTitle') : nameOf(setup)}>
        <Field
          label={t('setups.form.name')}
          hint={t('setups.form.nameHint')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        {setup === undefined ? (
          <>
            <Select
              label={t('setups.form.bow')}
              value={bowId}
              onChange={(event) => setBowId(event.target.value)}
              placeholder={t('setups.form.choose')}
              options={(bows.data?.items ?? []).map((b) => ({
                value: b.id,
                label: componentName(b) ?? b.id,
              }))}
              error={problems['bow']}
            />
            {nothingToChoose(bows) ? (
              <Link to="/bows/new" className="font-ui text-base text-info underline">
                {t('setups.form.loadNewBow')}
              </Link>
            ) : null}
            <Select
              label={t('setups.form.sight')}
              value={sightId}
              onChange={(event) => setSightId(event.target.value)}
              placeholder={t('setups.form.choose')}
              options={(sights.data?.items ?? []).map((s) => ({
                value: s.id,
                label: componentName(s) ?? s.id,
              }))}
              error={problems['sight']}
            />
            {nothingToChoose(sights) ? (
              <Link to="/sights/new" className="font-ui text-base text-info underline">
                {t('setups.form.loadNewSight')}
              </Link>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-1 font-ui text-base">
            <p>
              {t('setups.form.bow')}: {componentName(setup.bow) ?? '?'}
            </p>
            <p>
              {t('setups.form.sight')}: {componentName(setup.sight) ?? '?'}
            </p>
            <p className="text-sm text-muted">{t('setups.form.fixedPair')}</p>
          </div>
        )}

        <ArrowChoices
          choices={arrowChoices}
          selected={arrowIds}
          onToggle={toggle}
          error={problems['arrows']}
        />
        {nothingToChoose(arrows) ? (
          <Link to="/arrows/new" className="font-ui text-base text-info underline">
            {t('setups.form.loadNewArrows')}
          </Link>
        ) : null}
      </SectionCard>

      <Button type="submit" disabled={busy}>
        {busy ? t('common.loading') : t('common.save')}
      </Button>

      {setup === undefined ? null : (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              void action
                .run(setup.id, setup.status === 'archived' ? 'unarchive' : 'archive')
                .then(() => navigate({ to: '/' }))
                .catch(() => undefined)
            }
          >
            {setup.status === 'archived' ? t('setups.form.unarchive') : t('setups.form.archive')}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            {t('setups.form.delete')}
          </Button>
        </div>
      )}

      {setup === undefined ? null : (
        <BottomSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={t('setups.form.deleteTitle')}
          closeLabel={t('common.close')}
        >
          <p className="font-ui text-base">{t('setups.form.deleteBody')}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={trash.isPending}
              onClick={() =>
                void trash
                  .sendToTrash(setup.id)
                  .then(() => navigate({ to: '/' }))
                  .catch(() => undefined)
              }
            >
              {t('common.delete')}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </BottomSheet>
      )}
    </form>
  );
}
