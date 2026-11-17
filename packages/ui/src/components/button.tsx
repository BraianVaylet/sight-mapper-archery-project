import type { ButtonHTMLAttributes } from 'react';
import { cx, touchTarget } from '../touch.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** `lg` is the fixed primary action at the bottom of a screen (56 px, UX-UI §2.4). */
  size?: ButtonSize;
  /** Full width of its container. */
  block?: boolean;
};

const VARIANTS: Record<ButtonVariant, string> = {
  // A physical key: a hard edge underneath that the press pushes in (no blur, UX-UI §2.4).
  primary:
    'border-accent-edge bg-accent text-accent-ink shadow-key hover:brightness-105 active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--color-accent-edge)] disabled:shadow-none disabled:active:translate-y-0',
  secondary: 'border-border bg-transparent text-text hover:bg-raised',
  ghost: 'border-transparent bg-transparent text-text hover:bg-raised',
  danger: 'border-danger bg-transparent text-danger hover:bg-raised',
  link: 'border-transparent bg-transparent px-2 text-info underline underline-offset-[3px]',
};

/** Always at least 48×48 px. `type` defaults to `button` so a form never submits by accident. */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  type = 'button',
  className,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      style={{
        ...touchTarget,
        ...(size === 'lg' ? { minHeight: 'var(--sm-size-touch-lg)' } : {}),
        ...style,
      }}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-sm border-2 px-4 font-ui font-semibold',
        'transition-[transform,box-shadow,background-color] duration-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'text-lg' : 'text-base',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}
