import type { SightScale } from '@sight-mapper/domain';

/**
 * The two sets the author measured with an Ultraview Side 1 (2026-10-31): distance and reading
 * only, no personal data. They are the same numbers as `packages/domain/test/fixtures`, kept here
 * so the test bench can show them; the domain tests are the ones that pin what they must give.
 */
export const SANDBOX_SCALE: SightScale = {
  unit: 'cm',
  unitSizeMm: null,
  min: 0,
  max: 10,
  resolution: 0.1,
  direction: 'down',
};

export type SandboxMark = { readonly distanceM: number; readonly reading: number };

export type SandboxSet = {
  readonly id: 'good' | 'doubtful';
  readonly marks: readonly SandboxMark[];
};

export const SANDBOX_SETS: readonly SandboxSet[] = [
  {
    id: 'good',
    marks: [
      { distanceM: 20, reading: 0.3 },
      { distanceM: 30, reading: 0.8 },
      { distanceM: 40, reading: 1.6 },
      { distanceM: 50, reading: 2.6 },
      { distanceM: 60, reading: 3.6 },
    ],
  },
  {
    id: 'doubtful',
    marks: [
      { distanceM: 20, reading: 0.4 },
      { distanceM: 30, reading: 1.0 },
      { distanceM: 40, reading: 1.8 },
      { distanceM: 50, reading: 2.5 },
      { distanceM: 60, reading: 3.5 },
    ],
  },
];
