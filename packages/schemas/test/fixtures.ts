// Shared test data. Valid UUIDv7s (version nibble 7, variant 8).
export const ID = {
  a: '019a3c5f-7b1d-7e55-8f0e-0c4c1b9f2a77',
  b: '019a3c5f-7b1e-7c2a-9d40-5f1f3e2a8b10',
  c: '019a2f10-0000-7000-8000-000000000001',
  d: '019a2f10-0000-7000-8000-000000000002',
} as const;

/** A UUID v4: well formed but not v7. */
export const UUID_V4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

export const NOW = '2026-10-30T10:00:00.000Z';

export const resource = {
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
} as const;

export const customScale = {
  unit: 'custom',
  unitSizeMm: 10,
  min: 1,
  max: 9,
  resolution: 0.1,
  direction: 'down',
} as const;
