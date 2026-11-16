import { useEffect, type ReactNode } from 'react';
import { cx } from '../touch.js';
import { Button } from './button.js';

export const TOAST_DURATION_MS = 8_000;

export type ToastProps = {
  message: string;
  /** `Undo` and friends: runs the inverse action, then the toast goes away. */
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  dismissLabel: string;
  onDismiss: () => void;
  durationMs?: number | undefined;
};

/**
 * Confirms an optimistic action and offers to undo it for 8 s (UX-UI §1.4). A polite live
 * region, so a screen reader announces it without taking focus.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  durationMs = TOAST_DURATION_MS,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-md border border-border bg-surface p-3 text-text shadow-lg"
    >
      <p className="flex-1 font-ui text-base">{message}</p>
      {actionLabel && onAction ? (
        <Button
          variant="link"
          onClick={() => {
            onAction();
            onDismiss();
          }}
        >
          {actionLabel}
        </Button>
      ) : null}
      <Button variant="secondary" aria-label={dismissLabel} onClick={onDismiss}>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </Button>
    </div>
  );
}

export type AlertVariant = 'info' | 'warning' | 'danger';

const ALERT_STYLES: Record<AlertVariant, string> = {
  info: 'border-info text-info',
  warning: 'border-warning text-warning',
  danger: 'border-danger text-danger',
};

function AlertIcon({ variant }: { variant: AlertVariant }) {
  // A different shape per variant: the meaning does not depend on colour alone.
  const path =
    variant === 'info'
      ? 'M8 7v5M8 4.5v.5'
      : variant === 'warning'
        ? 'M8 2l6.5 11.5h-13zM8 6.5v3M8 11v.5'
        : 'M5 5l6 6M11 5l-6 6';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="shrink-0"
    >
      {variant === 'warning' ? null : <circle cx="8" cy="8" r="7" />}
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type InfoAlertProps = {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string | undefined;
};

/** A message in the page flow. `danger` interrupts the screen reader; the others are polite. */
export function InfoAlert({ variant = 'info', children, className }: InfoAlertProps) {
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-3 rounded-md border bg-surface p-3 font-ui text-base',
        ALERT_STYLES[variant],
        className,
      )}
    >
      <AlertIcon variant={variant} />
      <div className="text-text">{children}</div>
    </div>
  );
}

export type BadgeKind = 'registered' | 'calculated' | 'suspect' | 'inconsistent';

const BADGE_STYLES: Record<BadgeKind, string> = {
  registered: 'border-mark text-mark',
  calculated: 'border-info text-info',
  suspect: 'border-warning text-warning',
  inconsistent: 'border-danger text-danger',
};

/** Measured ≠ estimated (UX-UI §1.3): a filled circle vs a diamond, then a warning shape. */
function BadgeShape({ kind }: { kind: BadgeKind }) {
  const shape =
    kind === 'registered' ? (
      <circle cx="6" cy="6" r="5" fill="currentColor" />
    ) : kind === 'calculated' ? (
      <path d="M6 1l5 5-5 5-5-5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    ) : kind === 'suspect' ? (
      <path d="M6 1l5.5 10h-11z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    ) : (
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" />
    );
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12">
      {shape}
    </svg>
  );
}

export type StatusBadgeProps = {
  kind: BadgeKind;
  /** Already translated: "Registered", "Calculated"… */
  children: string;
};

export function StatusBadge({ kind, children }: StatusBadgeProps) {
  return (
    <span
      data-kind={kind}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-ui text-xs font-medium',
        BADGE_STYLES[kind],
      )}
    >
      <BadgeShape kind={kind} />
      {children}
    </span>
  );
}

export type EmptyStateProps = {
  title: string;
  description?: string | undefined;
  /** The one thing to do next: a `Button`. */
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <h2 className="font-display text-xl text-text">{title}</h2>
      {description ? (
        <p className="max-w-prose font-ui text-base text-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export type ErrorStateProps = {
  title: string;
  description?: string | undefined;
  retryLabel: string;
  onRetry: () => void;
  /** Shown so the archer can quote it to support (errors.md §6.6). */
  requestId?: string | undefined;
  requestIdLabel?: string | undefined;
};

/** Never a blank screen: what failed, a way to retry, and the id to report. */
export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  requestId,
  requestIdLabel,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center">
      <h2 className="font-display text-xl text-danger">{title}</h2>
      {description ? (
        <p className="max-w-prose font-ui text-base text-muted">{description}</p>
      ) : null}
      <Button onClick={onRetry}>{retryLabel}</Button>
      {requestId ? (
        <p className="font-ui text-xs text-muted">
          {requestIdLabel ? `${requestIdLabel} ` : null}
          <code className="select-all font-mono">{requestId}</code>
        </p>
      ) : null}
    </div>
  );
}

export type SkeletonProps = { className?: string | undefined };

/** A placeholder block. Decorative: put `aria-busy` on the region it stands in for. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx('animate-pulse rounded-sm bg-sunken', className ?? 'h-6 w-full')}
    />
  );
}

export type UpdatePromptProps = {
  message: string;
  actionLabel: string;
  onUpdate: () => void;
  dismissLabel: string;
  onDismiss: () => void;
};

/** "Hay una versión nueva · Actualizar". The archer decides when to reload (`registerType: prompt`). */
export function UpdatePrompt({
  message,
  actionLabel,
  onUpdate,
  dismissLabel,
  onDismiss,
}: UpdatePromptProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-4 z-50 flex items-center gap-3 rounded-md border border-info bg-surface p-3 text-text shadow-lg"
    >
      <p className="flex-1 font-ui text-base">{message}</p>
      <Button onClick={onUpdate}>{actionLabel}</Button>
      <Button variant="secondary" onClick={onDismiss}>
        {dismissLabel}
      </Button>
    </div>
  );
}
