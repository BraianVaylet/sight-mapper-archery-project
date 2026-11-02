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
import { bowHooks, type BowResource } from './bows.js';

type Filter = 'active' | 'archived';

/** The name an archer gives a bow: their nickname, or what the maker called it. */
export function bowName(bow: Pick<BowResource, 'nickname' | 'manufacturer' | 'model'>) {
  if (bow.nickname) return bow.nickname;
  const made = [bow.manufacturer, bow.model].filter(Boolean).join(' ');
  return made === '' ? undefined : made;
}

/** Your bows: active ones first, archived on request, newest edit on top (HU-BOW-01). */
export function BowsScreen() {
  const { t, locale, translate } = useI18n();
  const [filter, setFilter] = useState<Filter>('active');
  const list = bowHooks.useList({ status: filter });
  const action = bowHooks.useAction();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">{t('screens.bows')}</h1>
        <Link to="/bows/new" className={LinkButtonClass}>
          {t('bows.list.new')}
        </Link>
      </div>

      <Segmented
        label={t('bows.list.filter')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: t('bows.list.active') },
          { value: 'archived', label: t('bows.list.archived') },
        ]}
      />

      {list.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : list.isError ? (
        <ErrorState
          title={t('bows.list.loadError')}
          description={describeError(translate, list.error).text}
          retryLabel={t('common.retry')}
          onRetry={() => void list.refetch()}
          requestId={describeError(translate, list.error).requestId}
          requestIdLabel={t('common.requestId')}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title={filter === 'active' ? t('bows.list.emptyTitle') : t('bows.list.emptyArchived')}
          {...(filter === 'active' ? { description: t('bows.list.emptyBody') } : {})}
          action={
            filter === 'active' ? (
              <Link to="/bows/new" className={LinkButtonClass}>
                {t('bows.list.new')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((bow) => (
            <li key={bow.id}>
              <SectionCard title={bowName(bow) ?? t('bows.list.unnamed')} as="h2">
                <p className="font-ui text-sm text-muted">
                  {t('bows.list.edited', { date: formatDateTime(bow.updatedAt, locale) })}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {bow.status === 'archived' ? (
                    <StatusBadge kind="calculated">{t('bows.list.archivedBadge')}</StatusBadge>
                  ) : null}
                  <Link
                    to="/bows/$id"
                    params={{ id: bow.id }}
                    className="font-ui text-base text-info underline underline-offset-2"
                  >
                    {t('bows.form.editTitle')}
                  </Link>
                  <Button
                    variant="secondary"
                    disabled={action.isPending}
                    onClick={() =>
                      void action
                        .run(bow.id, bow.status === 'archived' ? 'unarchive' : 'archive')
                        .catch(() => undefined)
                    }
                  >
                    {bow.status === 'archived' ? t('bows.list.unarchive') : t('bows.list.archive')}
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
