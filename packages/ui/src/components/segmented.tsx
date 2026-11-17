import { useId, useRef, type KeyboardEvent } from 'react';
import { cx, touchTarget } from '../touch.js';

export type SegmentedOption<V extends string> = {
  value: V;
  label: string;
  disabled?: boolean;
};

export type SegmentedProps<V extends string> = {
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  error?: string | undefined;
  /** Short description under the name (what the setting changes). */
  hint?: string | undefined;
};

/** The indicator square of an instrument switch: the selection has a shape besides the colour. */
function SelectedMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 6 6" width="6" height="6" className="shrink-0">
      <rect width="6" height="6" fill="currentColor" />
    </svg>
  );
}

/**
 * Pick one of a few options (cam type, pin type, units). A radio group: one tab stop, arrow
 * keys move the selection, the selected option is filled with the accent and has an indicator
 * square besides the colour.
 */
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: SegmentedProps<V>) {
  const labelId = useId();
  const hintId = useId();
  const refs = useRef(new Map<V, HTMLButtonElement>());
  const enabled = options.filter((option) => !option.disabled);

  const move = (event: KeyboardEvent, from: V) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = enabled.findIndex((option) => option.value === from);
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    if (next === undefined) return;
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="font-ui text-sm font-medium text-text">
        {label}
      </span>
      {hint ? (
        <p id={hintId} className="font-ui text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        className="flex gap-[3px] rounded-sm border-2 border-border bg-sunken p-[3px]"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(node) => {
                if (node === null) refs.current.delete(option.value);
                else refs.current.set(option.value, node);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled}
              tabIndex={selected ? 0 : -1}
              style={touchTarget}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => move(event, option.value)}
              className={cx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-[1px] px-3 font-ui text-base',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'bg-accent font-semibold text-accent-ink'
                  : 'bg-transparent font-medium text-text hover:bg-raised',
              )}
            >
              {selected ? <SelectedMark /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
