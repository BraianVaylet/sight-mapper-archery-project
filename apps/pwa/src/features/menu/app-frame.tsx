import { AppHeader, Button, InfoAlert, NavDrawer, NavItem } from '@sight-mapper/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useClients } from '../../app/clients.js';
import { useI18n } from '../../app/i18n.js';
import { useUi } from '../../app/ui-store.js';
import { arrowSetHooks } from '../equipment/arrow-sets.js';
import { bowHooks } from '../equipment/bows.js';
import { sightHooks } from '../equipment/sights.js';
import { signOut } from '../auth/auth-api.js';
import { forgetSession } from '../auth/session.js';

type Destination =
  '/' | '/bows' | '/sights' | '/arrows' | '/trash' | '/settings/appearance' | '/profile';

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

/**
 * The frame of every screen behind the session: the header with the menu button, and the drawer
 * (RF-X-07): the counters of the archer's equipment, what is coming, the account, and the way out.
 */
export function AppFrame() {
  const { t, locale } = useI18n();
  const { authHttp } = useClients();
  const client = useQueryClient();
  const navigate = useNavigate();
  const open = useUi((state) => state.menuOpen);
  const setOpen = useUi((state) => state.setMenuOpen);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Counters are read when the drawer opens, not before: no requests just to draw a header.
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

  return (
    <>
      <AppHeader
        title={t('common.appName')}
        actions={
          <Button variant="secondary" aria-label={t('menu.open')} onClick={() => setOpen(true)}>
            <MenuIcon />
          </Button>
        }
      />
      <NavDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={t('menu.title')}
        closeLabel={t('common.close')}
      >
        <nav aria-label={t('menu.title')} className="flex flex-col gap-1">
          <NavItem label={t('menu.home')} onSelect={go('/')} current={current('/')} />
          <NavItem
            label={t('menu.bows')}
            count={bows.data?.items.length}
            onSelect={go('/bows')}
            current={current('/bows')}
          />
          <NavItem
            label={t('menu.sights')}
            count={sights.data?.items.length}
            onSelect={go('/sights')}
            current={current('/sights')}
          />
          <NavItem
            label={t('menu.arrows')}
            count={arrows.data?.items.length}
            onSelect={go('/arrows')}
            current={current('/arrows')}
          />
          <NavItem label={t('menu.stats')} badge={t('menu.soon')} />
          <NavItem label={t('menu.trash')} onSelect={go('/trash')} current={current('/trash')} />
          <NavItem
            label={t('menu.appearance')}
            onSelect={go('/settings/appearance')}
            current={current('/settings/appearance')}
          />
          <NavItem
            label={t('menu.profile')}
            onSelect={go('/profile')}
            current={current('/profile')}
          />
        </nav>
        {logout.isError ? <InfoAlert variant="danger">{t('menu.logoutError')}</InfoAlert> : null}
        <Button variant="secondary" disabled={logout.isPending} onClick={() => logout.mutate()}>
          {t('menu.logout')}
        </Button>
        {lastSync > 0 ? (
          <p className="font-ui text-sm text-muted">
            {t('menu.synced', {
              time: new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(lastSync),
            })}
          </p>
        ) : null}
      </NavDrawer>
      <Outlet />
    </>
  );
}
