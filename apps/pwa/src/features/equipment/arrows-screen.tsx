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
import { arrowSetHooks } from './arrow-sets.js';
import { LinkButtonClass } from './link-button.js';

type Filter = 'active' | 'archived';

/** Your arrow sets: active ones first, archived on request, newest edit on top (HU-ARW-01). */
export function ArrowsScreen() {
  const { t, locale, translate } = useI18n();
  const [filter, setFilter] = useState<Filter>('active');
  const list = arrowSetHooks.useList({ status: filter });
  const action = arrowSetHooks.useAction();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">{t('screens.arrows')}</h1>
        <Link to="/arrows/new" className={LinkButtonClass}>
          {t('arrows.list.new')}
        </Link>
      </div>

      <Segmented
        label={t('arrows.list.filter')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: t('arrows.list.active') },
          { value: 'archived', label: t('arrows.list.archived') },
        ]}
      />

      {list.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : list.isError ? (
        <ErrorState
          title={t('arrows.list.loadError')}
          description={describeError(translate, list.error).text}
          retryLabel={t('common.retry')}
          onRetry={() => void list.refetch()}
          requestId={describeError(translate, list.error).requestId}
          requestIdLabel={t('common.requestId')}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={filter === 'active' ? t('arrows.list.emptyTitle') : t('arrows.list.emptyArchived')}
          {...(filter === 'active' ? { description: t('arrows.list.emptyBody') } : {})}
          action={
            filter === 'active' ? (
              <Link to="/arrows/new" className={LinkButtonClass}>
                {t('arrows.list.new')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map((set) => (
            <li key={set.id}>
              <SectionCard title={set.name} as="h2">
                <p className="font-ui text-sm text-muted">
                  {t('arrows.list.edited', { date: formatDateTime(set.updatedAt, locale) })}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {set.status === 'archived' ? (
                    <StatusBadge kind="calculated">{t('arrows.list.archivedBadge')}</StatusBadge>
                  ) : null}
                  <Link
                    to="/arrows/$id"
                    params={{ id: set.id }}
                    className="font-ui text-base text-info underline underline-offset-2"
                  >
                    {t('arrows.form.editTitle')}
                  </Link>
                  <Button
                    variant="secondary"
                    disabled={action.isPending}
                    onClick={() =>
                      void action
                        .run(set.id, set.status === 'archived' ? 'unarchive' : 'archive')
                        .catch(() => undefined)
                    }
                  >
                    {set.status === 'archived'
                      ? t('arrows.list.unarchive')
                      : t('arrows.list.archive')}
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
