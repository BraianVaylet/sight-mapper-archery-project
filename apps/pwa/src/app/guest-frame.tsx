import type { ReactNode } from 'react';

/**
 * Frame of the screens without a session (UX-UI §4.6): the blueprint registration marks in two
 * corners of the viewport. Purely decorative, so hidden from assistive technology.
 */
export function GuestFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="blueprint-reg blueprint-reg-start" />
      <span aria-hidden="true" className="blueprint-reg blueprint-reg-end" />
      {children}
    </>
  );
}
