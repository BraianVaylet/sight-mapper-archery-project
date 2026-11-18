import { AppHeader, Button, Icon, InfoAlert, NavDrawer, NavGroup, NavItem } from '@sight-mapper/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useClients } from '../../app/clients.js';
import { useI18n } from '../../app/i18n.js';
import { useUi } from '../../app/ui-store.js';
import { useMediaQuery, WIDE_QUERY } from '../../app/use-media-query.js';
import { arrowSetHooks } from '../equipment/arrow-sets.js';
import { bowHooks } from '../equipment/bows.js';
import { sightHooks } from '../equipment/sights.js';
import { signOut } from '../auth/auth-api.js';
import { forgetSession } from '../auth/session.js';

type Destination =
  '/' | '/bows' | '/sights' | '/arrows' | '/doctor' | '/trash' | '/settings' | '/profile';

/** The app icon itself: a navy tile, the same in both themes (UX-UI §3). */
function Logo() {
  return <img src="/pwa-192.png" alt="" width={32} height={32} className="rounded-sm" />;
}

/**
 * The frame of every screen behind the session: the header and the menu (RF-X-07) with the
 * counters of the archer's equipment, what is coming, the account and the way out. Up to 1440 px
 * the menu is a drawer behind a button; from there on it is a side rail, always in view (UX-UI §7);
 * both on the right, the side of the menu button (spec §14).
 */
export function AppFrame() {
  const { t, locale } = useI18n();
  const { authHttp } = useClients();
  const client = useQueryClient();
  const navigate = useNavigate();
  const open = useUi((state) => state.menuOpen);
  const setOpen = useUi((state) => state.setMenuOpen);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const wide = useMediaQuery(WIDE_QUERY);

  const bows = bowHooks.useList({ status: 'active', limit: 100 });
  const sights = sightHooks.useList({ status: 'active', limit: 100 });
  const arrows = arrowSetHooks.useList({ status: 'active', limit: 100 });
  const lastSync = Math.max(bows.dataUpdatedAt, sights.dataUpdatedAt, arrows.dataUpdatedAt);

  const logout = useMutation({
    mutationFn: () => signOut(authHttp),
    onSuccess: async () => {
      setOpen(false);
      // The session goes first, so the sign-in guard sees nobody; the rest of the archer's data goes
      // once this frame is gone (clearing earlier would let its own queries fetch again).
      forgetSession(client);
      await navigate({ to: '/sign-in' });
      client.clear();
    },
  });

  const go = (to: Destination) => () => {
    setOpen(false);
    void navigate({ to });
  };
  const current = (to: Destination) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  const menu = (
    <>
      <nav aria-label={t('menu.title')} className="flex flex-col gap-5">
        <NavGroup index="01" label={t('menu.groupShooting')}>
          <NavItem
            icon={<Icon name="home" />}
            label={t('menu.home')}
            onSelect={go('/')}
            current={current('/')}
          />
          <NavItem
            icon={<Icon name="bow" />}
            label={t('menu.bows')}
            count={bows.data?.items.length}
            onSelect={go('/bows')}
            current={current('/bows')}
          />
          <NavItem
            icon={<Icon name="sight" />}
            label={t('menu.sights')}
            count={sights.data?.items.length}
            onSelect={go('/sights')}
            current={current('/sights')}
          />
          <NavItem
            icon={<Icon name="arrow" />}
            label={t('menu.arrows')}
            count={arrows.data?.items.length}
            onSelect={go('/arrows')}
            current={current('/arrows')}
          />
          <NavItem
            icon={<Icon name="doctor" />}
            label={t('menu.doctor')}
            onSelect={go('/doctor')}
            current={current('/doctor')}
          />
          <NavItem icon={<Icon name="stats" />} label={t('menu.stats')} badge={t('menu.soon')} />
        </NavGroup>
        <NavGroup index="02" label={t('menu.groupAccount')}>
          <NavItem
            icon={<Icon name="settings" />}
            label={t('menu.settings')}
            onSelect={go('/settings')}
            current={current('/settings')}
          />
          <NavItem
            icon={<Icon name="user" />}
            label={t('menu.profile')}
            onSelect={go('/profile')}
            current={current('/profile')}
          />
          <NavItem
            icon={<Icon name="trash" />}
            label={t('menu.trash')}
            onSelect={go('/trash')}
            current={current('/trash')}
          />
        </NavGroup>
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t-2 border-dotted border-line pt-4">
        {logout.isError ? <InfoAlert variant="danger">{t('menu.logoutError')}</InfoAlert> : null}
        <Button variant="secondary" disabled={logout.isPending} onClick={() => logout.mutate()}>
          <Icon name="logout" />
          {t('menu.logout')}
        </Button>
        {lastSync > 0 ? (
          <p className="font-mono text-xs text-muted">
            {t('menu.synced', {
              time: new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(lastSync),
            })}
          </p>
        ) : null}
      </div>
    </>
  );

  // The same tree in both layouts (only classes and the rail change), so a screen keeps its state
  // when the window crosses 1440 px.
  return (
    // Content first, then the rail on the right (spec §14): the DOM order is the reading and focus
    // order, so nothing needs a visual-only `order`.
    <div className={wide ? 'grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6' : 'contents'}>
      <div className={wide ? 'flex min-w-0 flex-col gap-4' : 'contents'}>
        <div className={wide ? undefined : 'mb-4'}>
          <AppHeader
            title={t('common.appName')}
            logo={<Logo />}
            brandLink={(brand, className) => (
              <Link
                to="/"
                aria-label={t('menu.homeLink', { app: t('common.appName') })}
                className={className}
                onClick={() => setOpen(false)}
              >
                {brand}
              </Link>
            )}
            actions={
              wide ? null : (
                <Button
                  variant="secondary"
                  aria-label={t('menu.open')}
                  onClick={() => setOpen(true)}
                >
                  <Icon name="menu" />
                </Button>
              )
            }
          />
        </div>
        <NavDrawer
          open={open && !wide}
          onClose={() => setOpen(false)}
          title={t('menu.title')}
          closeLabel={t('common.close')}
        >
          {menu}
        </NavDrawer>
        <Outlet />
      </div>
      {wide ? (
        <aside className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto rounded-md border-2 border-border bg-surface p-4 shadow-panel">
          {menu}
        </aside>
      ) : null}
    </div>
  );
}
