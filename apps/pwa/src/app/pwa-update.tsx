import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdateBanner } from './update-banner.js';

/** Connects the banner to the service worker. Kept apart so tests render the banner alone. */
export function PwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <UpdateBanner
      needRefresh={needRefresh}
      offlineReady={offlineReady}
      onUpdate={() => void updateServiceWorker(true)}
      onDismiss={() => {
        setNeedRefresh(false);
        setOfflineReady(false);
      }}
    />
  );
}
