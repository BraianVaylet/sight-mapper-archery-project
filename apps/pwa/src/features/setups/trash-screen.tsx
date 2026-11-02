import { formatDateTime } from '@sight-mapper/i18n';
import { Button, EmptyState, ErrorState, SectionCard, Skeleton } from '@sight-mapper/ui';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { useSetupName } from './home-screen.js';
import { useRestore, useTrash } from './setups.js';

/** The trash (HU-STP-04): what you deleted, and until when you can take it back. */
export function TrashScreen() {
  const { t, locale, translate } = useI18n();
  const trash = useTrash();
  const restore = useRestore();
  const nameOf = useSetupName();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">{t('screens.trash')}</h1>

      {trash.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : trash.isError ? (
        <ErrorState
          title={t('setups.trash.loadError')}
          description={describeError(translate, trash.error).text}
          retryLabel={t('common.retry')}
          onRetry={() => void trash.refetch()}
        />
      ) : trash.data.items.length === 0 ? (
        <EmptyState title={t('setups.trash.empty')} description={t('setups.trash.emptyBody')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {trash.data.items.map((setup) => (
            <li key={setup.id}>
              <SectionCard title={nameOf(setup)} as="h2">
                <p className="font-ui text-sm text-muted">
                  {t('setups.trash.marks', { count: setup.marksCount })} ·{' '}
                  {t('setups.trash.purge', { date: formatDateTime(setup.purgeAt, locale) })}
                </p>
                <div>
                  <Button
                    variant="secondary"
                    disabled={restore.isPending}
                    onClick={() => void restore.restore(setup.id).catch(() => undefined)}
                  >
                    {t('setups.trash.restore')}
                  </Button>
                </div>
              </SectionCard>
            </li>
          ))}
        </ul>
      )}

      {restore.isError ? (
        <p role="alert" className="font-ui text-base text-danger">
          {describeError(translate, restore.error).text}
        </p>
      ) : null}
    </section>
  );
}
