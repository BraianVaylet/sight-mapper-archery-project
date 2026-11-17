import { useId, type ReactNode } from 'react';
import { cx } from '../touch.js';

export type SectionCardProps = {
  title: string;
  /** Instrument number before the title (`01`), in the measured ink. */
  index?: string | undefined;
  /** Number of filled fields, shown after the title (`BOW IDENTITY ----- 2`). */
  count?: number | undefined;
  /** Heading level of the title; pick the one that fits the page outline. */
  as?: 'h2' | 'h3' | 'h4';
  children: ReactNode;
  className?: string | undefined;
};

/** A titled group of fields: number, small caps, a dotted rule and the field counter. */
export function SectionCard({
  title,
  index,
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
        'flex flex-col gap-4 rounded-md border-2 border-border bg-surface p-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {index ? (
          <span
            aria-hidden="true"
            className="font-mono text-xs font-semibold tracking-[0.12em] text-mark"
          >
            {index}
          </span>
        ) : null}
        <Heading
          id={titleId}
          className="font-mono text-xs font-semibold tracking-[0.12em] text-text uppercase"
        >
          {title}
        </Heading>
        <span aria-hidden="true" className="flex-1 border-t-2 border-dotted border-line" />
        {count === undefined ? null : (
          <span className="font-mono text-sm font-medium text-muted tabular-nums">{count}</span>
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
  /** The menu button, already built by the app (configuration lives in Settings, RF-ACC-04). */
  actions?: ReactNode;
  /**
   * Wraps the brand (logo, title and subtitle) in the app's own link to the Home (RF-X-08). It gets
   * the brand and the classes that keep it a ≥ 48 px target; `ui` stays router-agnostic.
   */
  brandLink?: ((brand: ReactNode, className: string) => ReactNode) | undefined;
};

/** Classes of the brand when it is a link: a 48 px target that fills the free width. */
const BRAND_LINK_CLASS =
  'flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-sm text-text no-underline';

export function AppHeader({ title, subtitle, logo, actions, brandLink }: AppHeaderProps) {
  const brand = (
    <>
      {logo ? (
        <span aria-hidden="true" className="shrink-0">
          {logo}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-semibold text-text">{title}</p>
        {subtitle ? <p className="truncate font-ui text-sm text-muted">{subtitle}</p> : null}
      </div>
    </>
  );
  return (
    <header className="flex items-center gap-3 border-b-2 border-border bg-raised px-4 py-3">
      {brandLink ? (
        brandLink(brand, BRAND_LINK_CLASS)
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{brand}</div>
      )}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
