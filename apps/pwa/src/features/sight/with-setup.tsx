import type { SetupView } from '@sight-mapper/schemas';
import { ErrorState, Skeleton } from '@sight-mapper/ui';
import type { ReactNode } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { setupHooks } from '../setups/setups.js';

/**
 * The setup of a screen about one of its tools: the loading skeleton and the error with Retry are
 * the same for all of them, so each screen only writes what it does once the setup is there.
 */
export function WithSetup({
  setupId,
  children,
}: {
  setupId: string;
  children: (setup: SetupView) => ReactNode;
}) {
  const { t, translate } = useI18n();
  const detail = setupHooks.useDetail(setupId);

  if (detail.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (detail.isError) {
    return (
      <ErrorState
        title={t('sight.loadError')}
        description={describeError(translate, detail.error).text}
        retryLabel={t('common.retry')}
        onRetry={() => void detail.refetch()}
      />
    );
  }
  return <>{children(detail.data)}</>;
}
