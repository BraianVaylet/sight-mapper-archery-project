import { Temporal } from '@js-temporal/polyfill';

/** The clock is injected everywhere: nothing reads the time on its own (CLAUDE.md). */
export type Clock = { now(): Temporal.Instant };

export const systemClock: Clock = {
  now: () => Temporal.Now.instant(),
};

/** A clock that always says the same instant, for tests. */
export function fixedClock(iso: string): Clock {
  const instant = Temporal.Instant.from(iso);
  return { now: () => instant };
}
