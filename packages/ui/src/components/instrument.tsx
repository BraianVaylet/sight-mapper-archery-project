import type { ReactNode } from 'react';
import { cx } from '../touch.js';

export type ReadoutTone = 'measured' | 'estimated' | 'none';

const TONE: Record<ReadoutTone, string> = {
  // Measured is ink of the scale, with a soft phosphor glow in the dark theme only (tokens.css).
  measured: 'text-mark sm-glow',
  estimated: 'text-info',
  none: 'text-text',
};

export type ReadingHudCell = {
  /** Instrument label, already translated ("Distancia", "Lectura a 50 m"). Shown in capitals. */
  label: string;
  /** The number, already converted and formatted for the archer ("50", "≈ 2,75"). */
  value: string;
  /** Unit beside the number, smaller ("m", "yd"). */
  unit?: string | undefined;
  tone?: ReadoutTone;
};

export type ReadingHudProps = {
  distance: ReadingHudCell;
  reading: ReadingHudCell;
  /** Badge, warnings and anything else under the reading. */
  footer?: ReactNode;
  /** Shown instead of the cells when nothing is picked yet. */
  placeholder?: string | undefined;
};

function Cell({ label, value, unit, tone = 'none' }: ReadingHudCell) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 pt-3 pb-4">
      <p className="font-mono text-xs font-semibold tracking-[0.12em] text-muted uppercase">
        {label}
      </p>
      <p
        className={cx(
          'font-mono leading-none font-semibold tracking-[-0.02em] tabular-nums',
          'text-[clamp(2.5rem,12vw,4.5rem)]',
          TONE[tone],
        )}
      >
        {value}
        {unit ? (
          <span className="ml-1.5 font-mono text-[22px] font-medium tracking-normal text-muted">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * The reading panel of the sight screen (UX-UI §4.2): the chosen distance and what goes on the
 * sight, the biggest numbers of the app. HUD corners mark it as the live instrument; they are the
 * only ones in the app. A polite live region: a screen reader hears the new reading.
 */
export function ReadingHud({ distance, reading, footer, placeholder }: ReadingHudProps) {
  return (
    <div
      aria-live="polite"
      className={cx(
        'relative rounded-md border-2 border-border bg-surface',
        "before:pointer-events-none before:absolute before:-top-0.5 before:-left-0.5 before:size-3.5 before:border-t-[3px] before:border-l-[3px] before:border-mark before:content-['']",
        "after:pointer-events-none after:absolute after:-right-0.5 after:-bottom-0.5 after:size-3.5 after:border-r-[3px] after:border-b-[3px] after:border-mark after:content-['']",
      )}
    >
      {placeholder !== undefined ? (
        <p className="p-4 font-ui text-base text-muted">{placeholder}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x-2 divide-line">
            <Cell {...distance} />
            <Cell {...reading} />
          </div>
          {footer ? (
            <div className="flex flex-wrap items-center gap-2 border-t-2 border-line px-4 py-2">
              {footer}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export type ActionBarProps = {
  /** Accessible name of the tool row ("Herramientas"). */
  toolsLabel: string;
  /** The tools, already built (`ActionTool`, links or buttons). */
  tools: ReactNode;
  /** The one primary action, a `Button size="lg" block`. */
  primary: ReactNode;
  /** The panel strip: setup on the left, live reading on the right. Decorative: the HUD says it. */
  strip?: { left: string; right?: string | undefined } | undefined;
  /** A toast (`inline`) shown just above the bar, so it never covers the primary action. */
  notice?: ReactNode;
  /**
   * Hidden while a sheet covers the screen, but kept mounted: the focus comes back to the primary
   * action when the sheet closes, and the toast keeps its time.
   */
  hidden?: boolean | undefined;
};

/**
 * The bar fixed at the bottom of the sight screen, in the thumb zone (UX-UI §4.2): the tools, the
 * primary action and the status strip. It respects the home indicator and never prints.
 */
export function ActionBar({
  toolsLabel,
  tools,
  primary,
  strip,
  notice,
  hidden = false,
}: ActionBarProps) {
  return (
    <div
      hidden={hidden}
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-surface"
    >
      {notice ? <div className="absolute inset-x-4 bottom-full mb-2">{notice}</div> : null}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 pt-3 pb-3">
        <div role="group" aria-label={toolsLabel} className="grid grid-cols-4 gap-2">
          {tools}
        </div>
        {primary}
      </div>
      {strip ? (
        <div
          aria-hidden="true"
          className="flex justify-between gap-3 border-t-2 border-border bg-sunken px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] font-mono text-xs font-semibold tracking-[0.12em] text-muted uppercase"
        >
          <span className="min-w-0 truncate">{strip.left}</span>
          {strip.right ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-mark before:size-2 before:rounded-full before:bg-current before:content-['']">
              {strip.right}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="pb-[env(safe-area-inset-bottom,0px)]" />
      )}
    </div>
  );
}

/** Classes of a tool cell: icon over a short label, 56 px, the same for links and buttons. */
export const ACTION_TOOL_CLASS =
  'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm border-2 border-border px-1 text-center font-ui text-[13px] leading-4 font-medium';

export type ActionToolProps = {
  icon: ReactNode;
  label: string;
  /** Why it is not available yet ("3/5", "Próximamente"). The tool is then disabled. */
  badge?: string | undefined;
};

/**
 * A tool that is not available (yet): visible, announced as disabled and going nowhere (RF-X-07).
 * Available tools are links built by the app with `ACTION_TOOL_CLASS`.
 */
export function ActionToolUnavailable({ icon, label, badge }: ActionToolProps) {
  return (
    <button
      type="button"
      aria-disabled="true"
      className={cx(ACTION_TOOL_CLASS, 'cursor-not-allowed text-muted')}
    >
      {icon}
      <span className="max-w-full hyphens-auto [overflow-wrap:anywhere]">{label}</span>
      {badge ? (
        <span className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
