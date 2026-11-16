import type { CSSProperties } from 'react';

/** Smallest tappable area: gloves, sun, one hand (UX-UI §1, WCAG 2.5.8 asks 24 px, we ask 44). */
export const TOUCH_TARGET_PX = 44;

/** Inline so the guarantee holds with no stylesheet loaded, and a test can read it. */
export const touchTarget: CSSProperties = {
  minHeight: `${TOUCH_TARGET_PX}px`,
  minWidth: `${TOUCH_TARGET_PX}px`,
};

export function cx(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(' ');
}
