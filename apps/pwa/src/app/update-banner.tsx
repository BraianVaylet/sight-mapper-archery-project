import { InfoAlert, UpdatePrompt } from '@sight-mapper/ui';
import { useI18n } from './i18n.js';

export type UpdateBannerProps = {
  needRefresh: boolean;
  offlineReady: boolean;
  /** Activates the waiting service worker and reloads. */
  onUpdate: () => void;
  onDismiss: () => void;
};

/** "Hay una versión nueva · Actualizar": offered, never imposed (`registerType: prompt`). */
export function UpdateBanner({
  needRefresh,
  offlineReady,
  onUpdate,
  onDismiss,
}: UpdateBannerProps) {
  const { t } = useI18n();
  if (needRefresh) {
    return (
      <UpdatePrompt
        message={t('app.update.message')}
        actionLabel={t('app.update.action')}
        onUpdate={onUpdate}
        dismissLabel={t('app.update.dismiss')}
        onDismiss={onDismiss}
      />
    );
  }
  if (offlineReady) {
    return (
      <div className="fixed inset-x-4 top-4 z-50">
        <InfoAlert variant="info">{t('app.offlineReady')}</InfoAlert>
      </div>
    );
  }
  return null;
}
