import { useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../hooks/use-focus-trap.js';
import { cx, touchTarget } from '../touch.js';
import { Button } from './button.js';

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  title: string;
  closeLabel: string;
  children: ReactNode;
};

/** Shared by the drawer and the sheet: a modal dialog with a scrim, focus trap and Escape. */
function Overlay({
  open,
  onClose,
  title,
  closeLabel,
  children,
  placement,
}: OverlayProps & { placement: 'left' | 'bottom' }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(open, panel, onClose);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'absolute flex flex-col gap-4 overflow-y-auto border-border bg-surface p-4 text-text',
          placement === 'left'
            ? 'inset-y-0 left-0 w-[min(20rem,85vw)] border-r'
            : 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-md border-t',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-ui text-lg font-semibold">
            {title}
          </h2>
          <Button variant="secondary" aria-label={closeLabel} onClick={onClose}>
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
        {children}
      </div>
    </div>
  );
}

/** The side menu. Closes on Escape, on the scrim and on its own close button. */
export function NavDrawer(props: OverlayProps) {
  return <Overlay {...props} placement="left" />;
}

/** The sheet that rises from the bottom, in the thumb zone (new / edit mark). */
export function BottomSheet(props: OverlayProps) {
  return <Overlay {...props} placement="bottom" />;
}

export type NavItemProps = {
  label: string;
  /** Number shown on the right (bows, sights, arrow sets). */
  count?: number | undefined;
  /** Text for something not available yet ("Próximamente"). The item is disabled. */
  badge?: string | undefined;
  onSelect?: (() => void) | undefined;
  current?: boolean | undefined;
};

/**
 * A drawer entry. A badged item stays focusable and announced as disabled, so a screen reader
 * user learns it exists and why it does nothing (RF-X-07).
 */
export function NavItem({ label, count, badge, onSelect, current }: NavItemProps) {
  const unavailable = badge !== undefined;
  return (
    <button
      type="button"
      aria-disabled={unavailable || undefined}
      aria-current={current ? 'page' : undefined}
      style={touchTarget}
      onClick={unavailable ? undefined : onSelect}
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-sm border px-3 text-left font-ui text-base',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
        unavailable
          ? 'cursor-not-allowed border-transparent text-muted'
          : 'border-transparent text-text',
        current ? 'bg-sunken' : '',
      )}
    >
      <span>{label}</span>
      {badge ? (
        <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted">
          {badge}
        </span>
      ) : count === undefined ? null : (
        <span className="font-display text-muted tabular-nums">{count}</span>
      )}
    </button>
  );
}
