import { InfoAlert } from '@sight-mapper/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { describeError } from '../../app/errors.js';
import { useI18n } from '../../app/i18n.js';

/**
 * Frame of the public screens: brand and one h1 on the blueprint paper, the form on an opaque card
 * (UX-UI §4.6: no data on the grid).
 */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 py-4">
      <img src="/pwa-192.png" alt="" width="64" height="64" className="rounded-md" />
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <div className="flex flex-col gap-4 rounded-md border-2 border-border bg-surface p-4">
        {children}
      </div>
    </section>
  );
}

/** A server error that is about the whole form, translated; the request id helps support. */
export function FormError({ error }: { error: unknown }) {
  const { translate, t } = useI18n();
  if (error === null || error === undefined) return null;
  const { text, requestId } = describeError(translate, error);
  return (
    <InfoAlert variant="danger">
      <p>{text}</p>
      {requestId === undefined ? null : (
        <p className="mt-1 text-sm text-muted">
          {t('common.requestId')} <code className="select-all font-mono">{requestId}</code>
        </p>
      )}
    </InfoAlert>
  );
}

export function TextLink({ children, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props} className="font-ui text-base text-info underline underline-offset-[3px]">
      {children}
    </Link>
  );
}
