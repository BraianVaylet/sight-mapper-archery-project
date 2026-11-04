import type { SetupView } from '@sight-mapper/schemas';
import { formatDateTime } from '@sight-mapper/i18n';
import { ErrorState, SectionCard, Skeleton, StatusBadge } from '@sight-mapper/ui';
import { Link } from '@tanstack/react-router';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { componentName } from '../equipment/names.js';
import { LinkButtonClass } from '../equipment/link-button.js';
import { FirstSetupGuide } from './first-setup-guide.js';
import { setupHooks, useToggleFavorite } from './setups.js';

/** What a card calls a setup: its own name, or the bow and the sight it joins. */
export function useSetupName() {
  const { t } = useI18n();
  return (setup: SetupView): string =>
    setup.name ??
    t('setups.home.joined', {
      bow: componentName(setup.bow) ?? '?',
      sight: componentName(setup.sight) ?? '?',
    });
}

function Star({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Your setups (HU-STP-02): favourites first, then the latest edit. The star changes at once. */
export function HomeScreen() {
  const { t, locale, translate } = useI18n();
  const list = setupHooks.useList({ status: 'active' });
  const favorite = useToggleFavorite();
  const nameOf = useSetupName();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">{t('screens.home')}</h1>
        <Link to="/setups/new" className={LinkButtonClass}>
          {t('setups.home.new')}
        </Link>
      </div>

      {list.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : list.isError ? (
        <ErrorState
          title={t('setups.home.loadError')}
          description={describeError(translate, list.error).text}
          retryLabel={t('common.retry')}
          onRetry={() => void list.refetch()}
          requestId={describeError(translate, list.error).requestId}
          requestIdLabel={t('common.requestId')}
        />
      ) : list.data.items.length === 0 ? (
        <FirstSetupGuide />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((setup) => (
            <li key={setup.id}>
              <SectionCard title={nameOf(setup)} as="h2">
                <div className="flex items-start justify-between gap-3">
                  <dl className="flex flex-col gap-1 font-ui text-base">
                    <dd>
                      {componentName(setup.bow) ?? '?'}
                      {setup.bow.status === 'archived' ? (
                        <span className="ml-2 text-sm text-warning">
                          ({t('setups.home.bowArchived')})
                        </span>
                      ) : null}
                    </dd>
                    <dd>
                      {t('setups.home.sightLine', {
                        sight: componentName(setup.sight) ?? '?',
                        pin: t(`setups.home.pin${capitalize(setup.sight.pinType)}`),
                      })}
                      {setup.sight.status === 'archived' ? (
                        <span className="ml-2 text-sm text-warning">
                          ({t('setups.home.sightArchived')})
                        </span>
                      ) : null}
                    </dd>
                    <dd className="text-muted">
                      {setup.arrowSets.map((set) => set.name).join(', ')}
                    </dd>
                  </dl>
                  <button
                    type="button"
                    aria-pressed={setup.isFavorite}
                    aria-label={
                      setup.isFavorite ? t('setups.home.unfavorite') : t('setups.home.favorite')
                    }
                    onClick={() => favorite.mutate({ id: setup.id, isFavorite: !setup.isFavorite })}
                    style={{ minWidth: 44, minHeight: 44 }}
                    className={`inline-flex shrink-0 items-center justify-center rounded-sm border border-border ${
                      setup.isFavorite ? 'text-mark' : 'text-muted'
                    }`}
                  >
                    <Star on={setup.isFavorite} />
                  </button>
                </div>
                <p className="font-ui text-sm text-muted">
                  {t('setups.home.marks', { count: setup.marksCount })} ·{' '}
                  {t('setups.home.edited', { date: formatDateTime(setup.updatedAt, locale) })}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  {setup.status === 'archived' ? (
                    <StatusBadge kind="calculated">{t('setups.home.archivedBadge')}</StatusBadge>
                  ) : null}
                  <Link
                    to="/setups/$setupId"
                    params={{ setupId: setup.id }}
                    className="font-ui text-base text-info underline underline-offset-2"
                  >
                    {t('setups.home.open')}
                  </Link>
                  <Link
                    to="/setups/$setupId/edit"
                    params={{ setupId: setup.id }}
                    className="font-ui text-base text-info underline underline-offset-2"
                  >
                    {t('setups.home.edit')}
                  </Link>
                </div>
              </SectionCard>
            </li>
          ))}
        </ul>
      )}

      {favorite.isError ? (
        <p role="alert" className="font-ui text-base text-danger">
          {t('setups.home.favoriteError')}
        </p>
      ) : null}

      <Link
        to="/trash"
        className="self-start font-ui text-base text-info underline underline-offset-2"
      >
        {t('setups.home.trash')}
      </Link>
    </section>
  );
}

const capitalize = (word: string): 'Monopin' | 'Dualpin' | 'Multipin' =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}` as 'Monopin' | 'Dualpin' | 'Multipin';
