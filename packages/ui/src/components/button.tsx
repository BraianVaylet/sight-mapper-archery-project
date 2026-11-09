import type { ButtonHTMLAttributes } from 'react';
import { cx, touchTarget } from '../touch.js';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const VARIANTS: Record<ButtonVariant, string> = {
  // The "physical button" of the design: a solid edge underneath.
  primary:
    'bg-accent text-accent-ink border border-accent-edge shadow-[0_3px_0_0_var(--color-accent-edge)] font-semibold active:translate-y-px active:shadow-[0_2px_0_0_var(--color-accent-edge)]',
  secondary: 'bg-transparent text-text border border-border font-medium',
  link: 'bg-transparent text-info underline underline-offset-2 border border-transparent font-medium',
};

/** Always at least 44×44 px. `type` defaults to `button` so a form never submits by accident. */
export function Button({
  variant = 'primary',
  type = 'button',
  className,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      style={{ ...touchTarget, ...style }}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-sm px-4 font-ui text-base',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}
