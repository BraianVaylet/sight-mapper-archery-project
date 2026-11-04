import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * While `active`: focus moves into the container, Tab cycles inside it, Escape calls `onEscape`
 * and, on close, focus returns to what had it before. What a dialog must do to be usable
 * without a mouse.
 */
export function useFocusTrap(
  active: boolean,
  container: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  // The latest handler, without being a dependency: a parent that passes a new function on every
  // render (typing in a field inside the dialog) must not restart the trap and steal the focus.
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    const root = container.current;
    if (!active || root === null) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? root).focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        escape.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, container]);
}
