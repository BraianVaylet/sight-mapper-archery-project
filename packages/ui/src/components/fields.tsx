import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cx, touchTarget } from '../touch.js';
import { Button } from './button.js';

type FieldChrome = {
  label: string;
  hint?: string | undefined;
  /** Already translated by the caller. Marks the field invalid. */
  error?: string | undefined;
};

// Focus ring: the global `:focus-visible` of the app (3 px `focus`, UX-UI §6).
const CONTROL =
  'w-full rounded-sm border-2 bg-sunken px-3 font-ui text-base text-text placeholder:text-muted ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/** A cross besides the colour: an error never relies on red alone. */
function ErrorIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className="shrink-0"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function describedBy(id: string, hint: string | undefined, error: string | undefined) {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return ids === '' ? undefined : ids;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-ui text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1 font-ui text-sm font-medium text-danger"
        >
          <ErrorIcon />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> &
  FieldChrome & {
    /** Unit or adornment shown inside the field on the right (`in`, `lb`, `m`). */
    suffix?: ReactNode;
  };

/** A labelled input with hint, error and an optional unit suffix. */
export function Field({
  label,
  hint,
  error,
  suffix,
  id: idProp,
  className,
  style,
  ...rest
}: FieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <div className="relative flex items-center">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          style={{ ...touchTarget, ...style }}
          className={cx(
            CONTROL,
            error ? 'border-danger' : 'border-border',
            suffix ? 'pr-12' : '',
            className,
          )}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 font-mono text-sm font-semibold text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldFrame>
  );
}

export type NumberFieldProps = Omit<FieldProps, 'type' | 'inputMode'> & {
  /** The unit the archer types in. */
  unit?: string | undefined;
};

/**
 * A number typed as text: the numeric keypad on phones, but `6,25` and `6 1/4` stay typable
 * (a `type="number"` field rejects both). Parsing is `parseDecimal` / `parseImperial` of the
 * domain, outside this component.
 */
export function NumberField({ unit, className, ...rest }: NumberFieldProps) {
  return (
    <Field
      className={cx('font-mono font-medium tabular-nums', className)}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      suffix={unit}
      {...rest}
    />
  );
}

export type PasswordFieldProps = Omit<FieldProps, 'type' | 'suffix'> & {
  showLabel: string;
  hideLabel: string;
};

export function PasswordField({
  showLabel,
  hideLabel,
  label,
  hint,
  error,
  id: idProp,
  ...rest
}: PasswordFieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const [visible, setVisible] = useState(false);
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          style={touchTarget}
          className={cx(CONTROL, error ? 'border-danger' : 'border-border')}
          {...rest}
        />
        <Button variant="link" aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          {visible ? hideLabel : showLabel}
        </Button>
      </div>
    </FieldFrame>
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> &
  FieldChrome & {
    options: readonly SelectOption[];
    placeholder?: string | undefined;
  };

/** The native select: best keyboard, screen reader and phone picker support there is. */
export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  id: idProp,
  className,
  style,
  ...rest
}: SelectProps) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <div className="relative flex items-center">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          style={{ ...touchTarget, ...style }}
          className={cx(
            CONTROL,
            'appearance-none pr-10',
            error ? 'border-danger' : 'border-border',
            className,
          )}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          className="pointer-events-none absolute right-3 text-text"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
    </FieldFrame>
  );
}
