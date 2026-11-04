import { LinkButtonClass } from './link-button.js';
import { formatDateTime } from '@sight-mapper/i18n';
import {
  Button,
  EmptyState,
  ErrorState,
  SectionCard,
  Segmented,
  Skeleton,
  StatusBadge,
} from '@sight-mapper/ui';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { sightHooks, type SightResource } from './sights.js';

type Filter = 'active' | 'archived';

/** The name an archer gives a sight: their nickname, or what the maker called it. */
export function sightName(sight: Pick<SightResource, 'nickname' | 'manufacturer' | 'model'>) {
  if (sight.nickname) return sight.nickname;
  const made = [sight.manufacturer, sight.model].filter(Boolean).join(' ');
  return made === '' ? undefined : made;
}

/** Your sights: active ones first, archived on request, newest edit on top (HU-BOW-01). */
export function SightsScreen() {
  const { t, locale, translate } = useI18n();
  const [filter, setFilter] = useState<Filter>('active');
  const list = sightHooks.useList({ status: filter });
  const action = sightHooks.useAction();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">{t('screens.sights')}</h1>
        <Link to="/sights/new" className={LinkButtonClass}>
          {t('sights.list.new')}
        </Link>
      </div>

      <Segmented
        label={t('sights.list.filter')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: t('sights.list.active') },
          { value: 'archived', label: t('sights.list.archived') },
        ]}
      />

      {list.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : list.isError ? (
        <ErrorState
          title={t('sights.list.loadError')}
          description={describeError(translate, list.error).text}
          retryLabel={t('common.retry')}
          onRetry={() => void list.refetch()}
          requestId={describeError(translate, list.error).requestId}
          requestIdLabel={t('common.requestId')}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={filter === 'active' ? t('sights.list.emptyTitle') : t('sights.list.emptyArchived')}
          {...(filter === 'active' ? { description: t('sights.list.emptyBody') } : {})}
          action={
            filter === 'active' ? (
              <Link to="/sights/new" className={LinkButtonClass}>
                {t('sights.list.new')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map((sight) => (
            <li key={sight.id}>
              <SectionCard title={sightName(sight) ?? t('sights.list.unnamed')} as="h2">
                <p className="font-ui text-sm text-muted">
                  {t('sights.list.scale', {
                    min: String(sight.scale.min),
                    max: String(sight.scale.max),
                    unit: sight.scale.unit,
                  })}{' '}
                  {t('sights.list.edited', { date: formatDateTime(sight.updatedAt, locale) })}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {sight.status === 'archived' ? (
                    <StatusBadge kind="calculated">{t('sights.list.archivedBadge')}</StatusBadge>
                  ) : null}
                  <Link
                    to="/sights/$id"
                    params={{ id: sight.id }}
                    className="font-ui text-base text-info underline underline-offset-2"
                  >
                    {t('sights.form.editTitle')}
                  </Link>
                  <Button
                    variant="secondary"
                    disabled={action.isPending}
                    onClick={() =>
                      void action
                        .run(sight.id, sight.status === 'archived' ? 'unarchive' : 'archive')
                        .catch(() => undefined)
                    }
                  >
                    {sight.status === 'archived'
                      ? t('sights.list.unarchive')
                      : t('sights.list.archive')}
                  </Button>
                </div>
              </SectionCard>
            </li>
          ))}
        </ul>
      )}
      {action.isError ? (
        <p role="alert" className="font-ui text-base text-danger">
          {describeError(translate, action.error).text}
        </p>
      ) : null}
    </section>
  );
}
