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
}: OverlayProps & { placement: 'right' | 'bottom' }) {
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
          'absolute flex flex-col gap-4 overflow-y-auto border-border bg-surface p-4 text-text shadow-panel',
          placement === 'right'
            ? 'inset-y-0 right-0 w-[min(20rem,85vw)] border-l-2'
            : 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg border-t-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
        )}
      >
        {placement === 'bottom' ? (
          <span aria-hidden="true" className="mx-auto -mb-2 h-1 w-10 shrink-0 rounded-sm bg-line" />
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {title}
          </h2>
          <Button variant="ghost" aria-label={closeLabel} onClick={onClose}>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
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

/** The side menu, from the right (spec §14: the side of the menu button). Closes on Escape, on the scrim and on its own close button. */
export function NavDrawer(props: OverlayProps) {
  return <Overlay {...props} placement="right" />;
}

/** The sheet that rises from the bottom, in the thumb zone (new / edit mark). */
export function BottomSheet(props: OverlayProps) {
  return <Overlay {...props} placement="bottom" />;
}

export type NavGroupProps = {
  /** Instrument number of the group (`01`). */
  index: string;
  /** Already translated: "Tiro", "Cuenta". Shown in capitals. */
  label: string;
  children: ReactNode;
};

/** A labelled group of drawer entries: `01 — TIRO`. */
export function NavGroup({ index, label, children }: NavGroupProps) {
  const labelId = useId();
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-1">
      <h3
        id={labelId}
        className="px-3 font-mono text-xs font-semibold tracking-[0.12em] text-muted uppercase"
      >
        <span aria-hidden="true" className="text-mark">
          {`${index} — `}
        </span>
        {label}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

export type NavItemProps = {
  label: string;
  /** 20 px line icon, decorative. */
  icon?: ReactNode;
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
export function NavItem({ label, icon, count, badge, onSelect, current }: NavItemProps) {
  const unavailable = badge !== undefined;
  return (
    <button
      type="button"
      aria-disabled={unavailable || undefined}
      aria-current={current ? 'page' : undefined}
      style={touchTarget}
      onClick={unavailable ? undefined : onSelect}
      className={cx(
        'flex w-full items-center gap-3 rounded-sm border-l-4 px-3 text-left font-ui text-base',
        unavailable ? 'cursor-not-allowed text-muted' : 'text-text hover:bg-raised',
        current ? 'border-accent bg-raised font-semibold' : 'border-transparent',
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-sm border border-border px-2 py-0.5 font-mono text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          {badge}
        </span>
      ) : count === undefined ? null : (
        <span className="font-mono text-muted tabular-nums">{count}</span>
      )}
    </button>
  );
}
