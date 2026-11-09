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
 *
 * A field that asked for the focus itself (`autoFocus`, like the distance of a new mark) keeps
 * it: the trap only moves the focus in when nothing inside has it yet.
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

  // Who had the focus before the dialog opened, read while rendering: by the time an effect runs,
  // an `autoFocus` field inside has already taken it, and the opener would be lost.
  const opener = useRef<HTMLElement | null>(null);
  if (!active) opener.current = null;
  else if (opener.current === null && typeof document !== 'undefined') {
    opener.current = document.activeElement as HTMLElement | null;
  }

  useEffect(() => {
    const root = container.current;
    if (!active || root === null) return undefined;

    const previouslyFocused = opener.current;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!root.contains(document.activeElement)) (focusables()[0] ?? root).focus();

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
      // Only when the dialog really went away. React's strict mode runs this cleanup and the effect
      // again on a dialog that stays: giving the focus back there would throw it out of the field.
      if (!root.isConnected) previouslyFocused?.focus();
    };
  }, [active, container]);
}
