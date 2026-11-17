import type { SetupView } from '@sight-mapper/schemas';
import { formatDateTime } from '@sight-mapper/i18n';
import { ErrorState, Icon, SetupCard, Skeleton, StatusBadge } from '@sight-mapper/ui';
import { Link } from '@tanstack/react-router';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { componentName } from '../equipment/names.js';
import { useQuickAccess } from '../account/profile.js';
import { LinkButtonLargeClass, LinkButtonSecondaryClass } from '../equipment/link-button.js';
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

/** Your setups (HU-STP-02): favourites first, then the latest edit. The star changes at once. */
export function HomeScreen() {
  const { t, locale, translate } = useI18n();
  const list = setupHooks.useList({ status: 'active' });
  const favorite = useToggleFavorite();
  const nameOf = useSetupName();
  const quickAccess = useQuickAccess();

  return (
    // Room at the bottom for the fixed primary action.
    <section className="flex flex-col gap-4 pb-28">
      <div className="flex flex-col gap-1">
        {list.data === undefined || list.data.items.length === 0 ? null : (
          <p className="font-mono text-xs font-semibold tracking-[0.12em] text-muted uppercase">
            {t('setups.home.countLabel', { count: list.data.items.length })}
          </p>
        )}
        <h1 className="font-display text-3xl font-bold">{t('screens.home')}</h1>
      </div>

      {list.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
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
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map((setup) => (
            <li key={setup.id}>
              <SetupCard
                title={nameOf(setup)}
                favorite={{
                  pressed: setup.isFavorite,
                  label: setup.isFavorite ? t('setups.home.unfavorite') : t('setups.home.favorite'),
                  onToggle: () => favorite.mutate({ id: setup.id, isFavorite: !setup.isFavorite }),
                }}
                details={[
                  {
                    label: t('setups.form.bow'),
                    value: componentName(setup.bow) ?? '?',
                    note:
                      setup.bow.status === 'archived' ? t('setups.home.bowArchived') : undefined,
                  },
                  {
                    label: t('setups.form.sight'),
                    value: t('setups.home.sightLine', {
                      sight: componentName(setup.sight) ?? '?',
                      pin: t(`setups.home.pin${capitalize(setup.sight.pinType)}`),
                    }),
                    tone: 'mark',
                    note:
                      setup.sight.status === 'archived'
                        ? t('setups.home.sightArchived')
                        : undefined,
                  },
                  {
                    label: t('setups.form.arrows'),
                    value: setup.arrowSets.map((set) => set.name).join(', '),
                  },
                ]}
                quickAccessLabel={
                  quickAccess?.setupId === setup.id ? t('quickAccess.badge') : undefined
                }
                meta={`${t('setups.home.marks', { count: setup.marksCount })} · ${t('setups.home.edited', { date: formatDateTime(setup.updatedAt, locale) })}`}
                actions={
                  <>
                    {setup.status === 'archived' ? (
                      <StatusBadge kind="calculated">{t('setups.home.archivedBadge')}</StatusBadge>
                    ) : null}
                    <Link
                      to="/setups/$setupId"
                      params={{ setupId: setup.id }}
                      className={LinkButtonSecondaryClass}
                    >
                      {t('setups.home.open')}
                      <Icon name="chevron" />
                    </Link>
                    <Link
                      to="/setups/$setupId/edit"
                      params={{ setupId: setup.id }}
                      className="inline-flex min-h-12 items-center font-ui text-base text-info underline underline-offset-[3px]"
                    >
                      {t('setups.home.edit')}
                    </Link>
                  </>
                }
              />
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
        className="inline-flex min-h-12 items-center self-start font-ui text-base text-info underline underline-offset-[3px]"
      >
        {t('setups.home.trash')}
      </Link>

      {/* The one primary action of the Home, in the thumb zone (UX-UI §4.1). */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-[1200px]">
          <Link to="/setups/new" className={LinkButtonLargeClass}>
            <Icon name="plus" />
            {t('setups.home.new')}
          </Link>
        </div>
      </div>
    </section>
  );
}

const capitalize = (word: string): 'Monopin' | 'Dualpin' | 'Multipin' =>
  `${word.charAt(0).toUpperCase()}${word.slice(1)}` as 'Monopin' | 'Dualpin' | 'Multipin';
