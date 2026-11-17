import type { ReactNode } from 'react';

/**
 * Line icons of the blueprint design system (UX-UI §2.4): 24-unit grid, 2 px stroke, square ends,
 * `currentColor`. Always decorative: the control that holds one carries the accessible name. The
 * shapes of the mark states (circle, diamond, triangle, cross) are not icons and live in
 * `StatusBadge`.
 */
const PATHS = {
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 6l-6 6 6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  home: <path d="M3 11l9-8 9 8M5 9.5V21h14V9.5" />,
  bow: <path d="M8 3c7 3 7 15 0 18M8 3v18" />,
  sight: (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
    </>
  ),
  arrow: <path d="M5 19L19 5M13 5h6v6M5 19v-4M5 19h4" />,
  stats: <path d="M3 21h18M6 21V11M11 21V5M16 21v-7" />,
  settings: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <path d="M13 4h4v4h-4zM7 10h4v4H7zM15 16h4v4h-4z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-5 15-5 16 0" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />,
  logout: <path d="M10 4H4v16h6M15 8l4 4-4 4M8 12h11" />,
  curve: <path d="M3 21h18M3 21V3M6 17c5 0 7-9 15-11" />,
  wind: <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3" />,
  doctor: <path d="M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 13l2 2 4-4" />,
  print: <path d="M7 9V3h10v6M7 17H4V9h16v8h-3M7 14h10v7H7z" />,
  pin: <path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export type IconProps = {
  name: IconName;
  /** 20 px in controls, 16 in badges. */
  size?: 16 | 20;
  className?: string | undefined;
};

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className={className ?? 'shrink-0'}
    >
      {PATHS[name]}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
