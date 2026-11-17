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
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto max-w-md overflow-hidden rounded-md border-2 border-border bg-surface text-text shadow-panel"
    >
      <div className="flex items-center gap-2 py-2 pr-2 pl-4">
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
        <Button variant="ghost" aria-label={dismissLabel} onClick={onDismiss}>
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
      <TimeBar durationMs={durationMs} />
    </div>
  );
}

/** How long the undo stays: a draining accent bar. Decorative, the toast says it in words. */
function TimeBar({ durationMs }: { durationMs: number }) {
  return (
    <div
      aria-hidden="true"
      className="h-[3px] origin-left bg-accent"
      style={{ animation: `sm-drain ${durationMs}ms linear forwards` }}
    />
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
      className="mt-0.5 shrink-0"
    >
      {variant === 'warning' ? null : <circle cx="8" cy="8" r="7" />}
      <path d={path} strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export type InfoAlertProps = {
  variant?: AlertVariant;
  /** Optional bold first line. */
  title?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
};

/** A message in the page flow. `danger` interrupts the screen reader; the others are polite. */
export function InfoAlert({ variant = 'info', title, children, className }: InfoAlertProps) {
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-3 rounded-md border-2 bg-surface p-3 font-ui text-base',
        ALERT_STYLES[variant],
        className,
      )}
    >
      <AlertIcon variant={variant} />
      <div className="text-text">
        {title ? <strong className="block font-semibold">{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}

export type BadgeKind = 'registered' | 'calculated' | 'suspect' | 'inconsistent';

const BADGE_STYLES: Record<BadgeKind, string> = {
  registered: 'border-mark text-mark',
  calculated: 'border-dashed border-info text-info',
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
        'inline-flex items-center gap-1.5 rounded-sm border-[1.5px] px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.08em] uppercase',
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

/** The glyph of the empty and error states: a piece of a sight scale. Decorative. */
function ScaleGlyph({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width="64"
      height="64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className={className}
    >
      <path d="M40 6v52M40 10h12M40 22h8M40 34h12M40 46h8M40 58h12" />
      <path d="M8 32h22" />
      <circle cx="30" cy="32" r="4" fill="currentColor" />
    </svg>
  );
}

const STATE_FRAME =
  'flex flex-col items-center gap-3 rounded-md border-2 bg-surface px-4 py-10 text-center';

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={cx(STATE_FRAME, 'border-dashed border-border')}>
      <ScaleGlyph className="text-mark" />
      <h2 className="font-display text-2xl font-semibold text-text">{title}</h2>
      {description ? (
        <p className="max-w-[36ch] font-ui text-lg text-muted">{description}</p>
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
    <div role="alert" className={cx(STATE_FRAME, 'border-danger')}>
      <ScaleGlyph className="text-danger" />
      <h2 className="font-display text-2xl font-semibold text-danger">{title}</h2>
      {description ? (
        <p className="max-w-[36ch] font-ui text-lg text-muted">{description}</p>
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

/**
 * A placeholder block that sweeps like a scanner. Decorative: put `aria-busy` on the region it
 * stands in for. Reduced motion stops the sweep (tokens.css).
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'rounded-sm bg-[linear-gradient(90deg,var(--color-raised)_0_40%,var(--color-line)_50%,var(--color-raised)_60%_100%)] bg-[length:300%_100%] animate-[sm-scan_1.4s_linear_infinite]',
        className ?? 'h-6 w-full',
      )}
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
      className="fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top,0px))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-md border-2 border-info bg-surface p-3 text-text shadow-panel"
    >
      <p className="flex-1 font-ui text-base">{message}</p>
      <Button onClick={onUpdate}>{actionLabel}</Button>
      <Button variant="secondary" onClick={onDismiss}>
        {dismissLabel}
      </Button>
    </div>
  );
}
