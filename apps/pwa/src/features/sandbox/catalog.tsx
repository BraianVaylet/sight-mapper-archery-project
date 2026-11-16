import {
  AppHeader,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InfoAlert,
  NavDrawer,
  NavItem,
  NumberField,
  PasswordField,
  SectionCard,
  Segmented,
  Select,
  Skeleton,
  StatusBadge,
  Toast,
  UpdatePrompt,
} from '@sight-mapper/ui';
import { useState, type ReactNode } from 'react';
import { useI18n } from '../../app/i18n.js';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-ui text-sm font-semibold text-muted">{title}</h3>
      {children}
    </div>
  );
}

/** Every primitive of `@sight-mapper/ui` in one place, to judge it in both themes and languages. */
export function Catalog() {
  const { t } = useI18n();
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [sheet, setSheet] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(true);
  const noop = () => undefined;
  const close = t('common.close');

  return (
    <SectionCard title={t('sandbox.catalog.title')}>
      <div className="flex flex-col gap-8">
        <Group title={t('sandbox.catalog.header')}>
          <div className="overflow-hidden rounded-md border border-border">
            <AppHeader title={t('common.appName')} subtitle={t('screens.home')} />
          </div>
        </Group>

        <Group title={t('sandbox.catalog.buttons')}>
          <div className="flex flex-wrap items-center gap-3">
            <Button>{t('sandbox.catalog.primary')}</Button>
            <Button variant="secondary">{t('sandbox.catalog.secondary')}</Button>
            <Button variant="link">{t('sandbox.catalog.link')}</Button>
            <Button disabled>{t('sandbox.catalog.disabled')}</Button>
          </div>
        </Group>

        <Group title={t('sandbox.catalog.fields')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('sandbox.catalog.sampleText')} hint={t('sandbox.catalog.sampleHint')} />
            <Field
              label={t('sandbox.catalog.sampleText')}
              defaultValue="x"
              error={t('sandbox.catalog.sampleError')}
            />
            <NumberField label={t('sandbox.catalog.sampleNumber')} unit="cm" defaultValue="10,5" />
            <PasswordField
              label={t('sandbox.catalog.samplePassword')}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              autoComplete="off"
            />
            <Select
              label={t('sandbox.catalog.sampleSelect')}
              placeholder={t('sandbox.catalog.selectPlaceholder')}
              defaultValue=""
              options={[
                { value: 'one', label: t('sandbox.catalog.optionOne') },
                { value: 'two', label: t('sandbox.catalog.optionTwo') },
              ]}
            />
          </div>
          <Segmented
            label={t('sandbox.catalog.segmented')}
            value={units}
            onChange={setUnits}
            options={[
              { value: 'metric', label: t('sandbox.catalog.metric') },
              { value: 'imperial', label: t('sandbox.catalog.imperial') },
            ]}
          />
        </Group>

        <Group title={t('sandbox.catalog.badges')}>
          <div className="flex flex-wrap gap-3">
            <StatusBadge kind="registered">{t('sandbox.catalog.registered')}</StatusBadge>
            <StatusBadge kind="calculated">{t('sandbox.catalog.calculated')}</StatusBadge>
            <StatusBadge kind="suspect">{t('sandbox.catalog.suspect')}</StatusBadge>
            <StatusBadge kind="inconsistent">{t('sandbox.catalog.inconsistent')}</StatusBadge>
          </div>
        </Group>

        <Group title={t('sandbox.catalog.alerts')}>
          <InfoAlert variant="info">{t('sandbox.catalog.info')}</InfoAlert>
          <InfoAlert variant="warning">{t('sandbox.catalog.warning')}</InfoAlert>
          <InfoAlert variant="danger">{t('sandbox.catalog.danger')}</InfoAlert>
        </Group>

        <Group title={t('sandbox.catalog.states')}>
          <EmptyState
            title={t('sandbox.catalog.emptyTitle')}
            description={t('sandbox.catalog.emptyBody')}
            action={<Button>{t('sandbox.catalog.emptyAction')}</Button>}
          />
          <ErrorState
            title={t('sandbox.catalog.errorTitle')}
            retryLabel={t('common.retry')}
            onRetry={noop}
            requestId="01927e5a-0000-7000-8000-000000000000"
            requestIdLabel={t('common.requestId')}
          />
          <div aria-busy="true" className="flex flex-col gap-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        </Group>

        <Group title={t('sandbox.catalog.overlays')}>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setSheet(true)}>
              {t('sandbox.catalog.openSheet')}
            </Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>
              {t('sandbox.catalog.openDrawer')}
            </Button>
          </div>
          <BottomSheet
            open={sheet}
            onClose={() => setSheet(false)}
            title={t('sandbox.catalog.sheetTitle')}
            closeLabel={close}
          >
            <Field label={t('sandbox.catalog.sampleText')} />
            <Button onClick={() => setSheet(false)}>{t('common.save')}</Button>
          </BottomSheet>
          <NavDrawer
            open={drawer}
            onClose={() => setDrawer(false)}
            title={t('sandbox.catalog.drawerTitle')}
            closeLabel={close}
          >
            <NavItem label={t('sandbox.catalog.navBows')} count={2} current />
            <NavItem label={t('sandbox.catalog.navSoon')} badge={t('sandbox.catalog.soon')} />
          </NavDrawer>
        </Group>

        <Group title={t('sandbox.catalog.toast')}>
          <div className="relative h-24 transform-gpu">
            {toast ? (
              <Toast
                message={t('sandbox.catalog.toastMessage')}
                actionLabel={t('common.undo')}
                onAction={() => setToast(false)}
                dismissLabel={close}
                onDismiss={() => setToast(false)}
                durationMs={60_000}
              />
            ) : (
              <Button variant="secondary" onClick={() => setToast(true)}>
                {t('sandbox.catalog.toast')}
              </Button>
            )}
          </div>
        </Group>

        <Group title={t('sandbox.catalog.update')}>
          <div className="relative h-24 transform-gpu">
            <UpdatePrompt
              message={t('app.update.message')}
              actionLabel={t('app.update.action')}
              onUpdate={noop}
              dismissLabel={t('app.update.dismiss')}
              onDismiss={noop}
            />
          </div>
        </Group>
      </div>
    </SectionCard>
  );
}
