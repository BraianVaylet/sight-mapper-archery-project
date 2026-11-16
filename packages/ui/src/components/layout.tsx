import { useId, type ReactNode } from 'react';
import { cx } from '../touch.js';

export type SectionCardProps = {
  title: string;
  /** Number of filled fields, shown after the title (`BOW IDENTITY ----- 2`). */
  count?: number | undefined;
  /** Heading level of the title; pick the one that fits the page outline. */
  as?: 'h2' | 'h3' | 'h4';
  children: ReactNode;
  className?: string | undefined;
};

/** A titled group of fields: small caps, a dotted rule and the field counter. */
export function SectionCard({
  title,
  count,
  as: Heading = 'h2',
  children,
  className,
}: SectionCardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cx(
        'flex flex-col gap-4 rounded-md border border-border bg-surface p-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Heading
          id={titleId}
          className="font-ui text-sm font-semibold tracking-widest text-text uppercase"
        >
          {title}
        </Heading>
        <span aria-hidden="true" className="flex-1 border-t border-dotted border-border" />
        {count === undefined ? null : (
          <span className="font-display text-sm text-muted tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

export type AppHeaderProps = {
  title: string;
  subtitle?: string | undefined;
  /** The brand mark, decorative. */
  logo?: ReactNode;
  /** Theme toggle, menu button… already built by the app. */
  actions?: ReactNode;
};

export function AppHeader({ title, subtitle, logo, actions }: AppHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
      {logo ? (
        <span aria-hidden="true" className="shrink-0">
          {logo}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-lg font-semibold text-text">{title}</p>
        {subtitle ? <p className="truncate font-ui text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
