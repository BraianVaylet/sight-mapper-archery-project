import { ErrorState } from '@sight-mapper/ui';
import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { describeError } from './errors.js';
import { useI18n } from './i18n.js';

/** A failure in one route never blanks the app: the message, a retry and the way home. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t, translate } = useI18n();
  const router = useRouter();
  const { text, requestId } = describeError(translate, error);
  return (
    <>
      <ErrorState
        title={t('app.routeError.title')}
        description={text}
        retryLabel={t('common.retry')}
        onRetry={() => {
          // Loaders and guards ran already and failed: ask them again, then redraw.
          void router.invalidate();
          reset();
        }}
        requestId={requestId}
        requestIdLabel="ID"
      />
      <p className="text-center">
        <Link to="/" className="font-ui text-info underline">
          {t('app.routeError.home')}
        </Link>
      </p>
    </>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center">
      <h1 className="font-display text-xl">{t('app.notFound.title')}</h1>
      <p className="font-ui text-base text-muted">{t('app.notFound.body')}</p>
      <Link to="/" className="font-ui text-info underline">
        {t('app.routeError.home')}
      </Link>
    </div>
  );
}

/** Shown while a guard or loader is still asking the server: never a blank screen. */
export function Splash() {
  const { t } = useI18n();
  return (
    <div role="status" className="flex flex-col items-center gap-3 p-16 text-center">
      <img src="/pwa-192.png" alt="" width="96" height="96" className="rounded-md" />
      <p className="font-ui text-base text-muted">{t('app.splash')}</p>
    </div>
  );
}
