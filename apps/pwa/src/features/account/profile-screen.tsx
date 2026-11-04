import { useHttp } from '@sight-mapper/client';
import { formatDate } from '@sight-mapper/i18n';
import { accountExport, DELETION_DAYS } from '@sight-mapper/schemas';
import {
  BottomSheet,
  Button,
  ErrorState,
  Field,
  InfoAlert,
  SectionCard,
  Skeleton,
} from '@sight-mapper/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';
import { useClients } from '../../app/clients.js';
import { sessionQuery } from '../auth/session.js';
import { saveJsonFile } from './download.js';
import { profileQuery, useCancelDeletion, useRequestDeletion, useUnitSystem } from './profile.js';

/** The account (HU-ACC-05, HU-ACC-06): who is signed in, a copy of the data, and the way out. */
export function ProfileScreen() {
  const { t, locale, translate } = useI18n();
  const http = useHttp();
  const { authHttp } = useClients();
  const system = useUnitSystem();
  const units = { system, locale };

  const session = useQuery(sessionQuery(authHttp));
  const profile = useQuery(profileQuery(http));

  const download = useMutation({
    mutationFn: async () => {
      const data = await http.get('/me/export', { schema: accountExport });
      const file = `sight-mapper-${data.exportedAt.slice(0, 10)}.json`;
      saveJsonFile(file, data);
      return file;
    },
  });
  const requestDeletion = useRequestDeletion();
  const cancelDeletion = useCancelDeletion();

  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  if (profile.isPending || session.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (profile.isError || session.isError) {
    return (
      <ErrorState
        title={t('profile.loadError')}
        description={describeError(translate, profile.error ?? session.error, units).text}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void profile.refetch();
          void session.refetch();
        }}
      />
    );
  }

  const user = session.data?.user;
  const requested = profile.data.deletionRequestedAt !== null;
  // What the archer types to confirm: their username, or their email when they have none.
  const word = user?.username ?? user?.email ?? '';

  const rows: [string, string][] = [
    ...(user?.username == null
      ? []
      : ([[t('profile.username'), user.username]] as [string, string][])),
    [t('profile.email'), user?.email ?? ''],
    [t('profile.version'), __APP_VERSION__],
  ];

  const close = () => {
    setConfirming(false);
    setTyped('');
  };

  return (
    <section className="flex flex-col gap-4 pb-8">
      <h1 className="font-display text-2xl">{t('screens.profile')}</h1>

      <SectionCard title={t('profile.accountTitle')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-ui text-base">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title={t('profile.dataTitle')}>
        <p className="font-ui text-base text-muted">{t('profile.dataBody')}</p>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            className="self-start"
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            {t(download.isPending ? 'profile.downloading' : 'profile.download')}
          </Button>
          {download.isSuccess ? (
            <p role="status" className="font-ui text-sm text-muted">
              {t('profile.downloaded', { file: download.data })}
            </p>
          ) : null}
          {download.isError ? (
            <InfoAlert variant="danger">
              {describeError(translate, download.error, units).text || t('profile.downloadError')}
            </InfoAlert>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title={t('profile.deleteTitle')}>
        {requested ? (
          <div className="flex flex-col gap-3">
            <InfoAlert variant="warning">
              <strong className="block">{t('profile.requestedTitle')}</strong>
              {t('profile.requestedBody', {
                date: formatDate(
                  profile.data.purgeAt ?? profile.data.deletionRequestedAt ?? '',
                  locale,
                ),
              })}
            </InfoAlert>
            <Button
              className="self-start"
              disabled={cancelDeletion.isPending}
              onClick={() => cancelDeletion.mutate()}
            >
              {t('profile.cancel')}
            </Button>
            {cancelDeletion.isError ? (
              <InfoAlert variant="danger">
                {describeError(translate, cancelDeletion.error, units).text}
              </InfoAlert>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-ui text-base text-muted">
              {t('profile.deleteBody', { days: DELETION_DAYS })}
            </p>
            {cancelDeletion.isSuccess ? (
              <p role="status" className="font-ui text-sm text-muted">
                {t('profile.cancelled')}
              </p>
            ) : null}
            <Button variant="secondary" className="self-start" onClick={() => setConfirming(true)}>
              {t('profile.deleteButton')}
            </Button>
          </div>
        )}
      </SectionCard>

      {confirming ? (
        <BottomSheet
          open
          onClose={close}
          title={t('profile.confirmTitle')}
          closeLabel={t('common.close')}
        >
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (typed !== word) return;
              requestDeletion.mutate(undefined, { onSuccess: close });
            }}
          >
            <p className="font-ui text-base">{t('profile.confirmBody', { days: DELETION_DAYS })}</p>
            {requestDeletion.isError ? (
              <InfoAlert variant="danger">
                {describeError(translate, requestDeletion.error, units).text}
              </InfoAlert>
            ) : null}
            <Field
              label={t('profile.confirmLabel', { word })}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={typed !== word || requestDeletion.isPending}>
                {t('profile.confirm')}
              </Button>
              <Button variant="secondary" onClick={close}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </section>
  );
}
