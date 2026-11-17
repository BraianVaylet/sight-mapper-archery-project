import { useId, type ReactNode } from 'react';
import { cx, touchTarget } from '../touch.js';
import { Icon } from './icon.js';

export type SetupCardDetail = {
  /** Instrument label, already translated ("Arco", "Mira"). */
  label: string;
  value: string;
  /** `mark` for what identifies the setup (the sight), in the measured ink. */
  tone?: 'mark' | 'plain';
  /** A short warning next to the value ("arco archivado"). */
  note?: string | undefined;
};

export type SetupCardProps = {
  title: string;
  /** Heading level of the title; pick the one that fits the page outline. */
  as?: 'h2' | 'h3';
  details: readonly SetupCardDetail[];
  favorite: { pressed: boolean; label: string; onToggle: () => void };
  /** "Acceso rápido": the app opens on this setup. */
  quickAccessLabel?: string | undefined;
  /** Marks and last edit, already formatted. */
  meta: string;
  /** Open and edit links, built by the app. */
  actions: ReactNode;
};

function Star({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A setup on the Home (UX-UI §4.1): the name, the star of favourites, a sunken technical block
 * (bow, sight in the measured ink, arrows), the quick-access badge and the last edit. Every card
 * looks the same: the order and the badge carry the hierarchy.
 */
export function SetupCard({
  title,
  as: Heading = 'h2',
  details,
  favorite,
  quickAccessLabel,
  meta,
  actions,
}: SetupCardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex h-full flex-col gap-3 rounded-md border-2 border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <Heading id={titleId} className="min-w-0 font-display text-2xl font-semibold break-words">
          {title}
        </Heading>
        <button
          type="button"
          aria-pressed={favorite.pressed}
          aria-label={favorite.label}
          onClick={favorite.onToggle}
          style={touchTarget}
          className={cx(
            'inline-flex shrink-0 items-center justify-center rounded-sm border-2 border-border hover:bg-raised',
            favorite.pressed ? 'text-mark' : 'text-muted',
          )}
        >
          <Star on={favorite.pressed} />
        </button>
      </div>

      <dl className="grid gap-3 rounded-sm border border-line bg-sunken p-3 sm:grid-cols-2">
        {details.map((detail) => (
          <div key={detail.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="font-mono text-xs font-semibold tracking-[0.12em] text-muted uppercase">
              {detail.label}
            </dt>
            <dd
              className={cx(
                'font-ui text-base font-semibold break-words',
                detail.tone === 'mark' ? 'text-mark' : 'text-text',
              )}
            >
              {detail.value}
              {detail.note ? (
                <span className="ml-2 text-sm font-normal text-warning">{`(${detail.note})`}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {quickAccessLabel ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-[0.1em] text-mark uppercase">
            <Icon name="pin" size={16} />
            {quickAccessLabel}
          </span>
        ) : null}
        <p className="font-mono text-sm text-muted">{meta}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-4 border-t-2 border-dotted border-line pt-2">
        {actions}
      </div>
    </section>
  );
}
