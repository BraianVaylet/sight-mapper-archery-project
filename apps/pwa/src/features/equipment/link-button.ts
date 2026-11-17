/** A link that looks and sizes like the primary `Button` (≥ 48 px), for navigation that is not an action. */
export const LinkButtonClass =
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-sm border-2 border-accent-edge bg-accent px-4 font-ui text-base font-semibold text-accent-ink shadow-key active:translate-y-0.5';

/** The same link as the fixed primary action at the bottom of a screen: 56 px, full width. */
export const LinkButtonLargeClass = `${LinkButtonClass} min-h-14 w-full text-lg`;

/** A link that looks like the secondary `Button`: outlined, for a step that is not the screen's one primary action. */
export const LinkButtonSecondaryClass =
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-sm border-2 border-border px-4 font-ui text-base font-semibold text-text hover:bg-raised';
