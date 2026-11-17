import { useSyncExternalStore } from 'react';

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * Whether a media query matches now, following it as the window changes. False where there is no
 * `matchMedia` (tests, old engines): the narrow layout is the safe default.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!supported()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => supported() && window.matchMedia(query).matches,
    () => false,
  );
}

/** UX-UI §7: from 1440 px the menu is a fixed side rail instead of a drawer. */
export const WIDE_QUERY = '(min-width: 1440px)';
