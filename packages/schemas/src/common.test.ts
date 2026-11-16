import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { UUID_V4 } from '../test/fixtures.js';
import {
  componentStatus,
  cursor,
  DEFAULT_PAGE_SIZE,
  isMillimetre,
  isoDateTime,
  listQuery,
  MAX_PAGE_SIZE,
  page,
  uuidv7,
} from './common.js';

describe('uuidv7', () => {
  it('accepts v7 and rejects other versions', () => {
    expect(uuidv7.safeParse('019a3c5f-7b1d-7e55-8f0e-0c4c1b9f2a77').success).toBe(true);
    expect(uuidv7.safeParse(UUID_V4).success).toBe(false);
    expect(uuidv7.safeParse('').success).toBe(false);
    expect(uuidv7.safeParse(7).success).toBe(false);
  });
});

describe('isoDateTime', () => {
  it('accepts UTC and offset instants, rejects loose dates', () => {
    expect(isoDateTime.safeParse('2026-10-29T15:20:00Z').success).toBe(true);
    expect(isoDateTime.safeParse('2026-10-29T15:20:00.123Z').success).toBe(true);
    expect(isoDateTime.safeParse('2026-10-29T12:20:00-03:00').success).toBe(true);
    expect(isoDateTime.safeParse('2026-10-29').success).toBe(false);
    expect(isoDateTime.safeParse('29/10/2026').success).toBe(false);
  });
});

describe('listQuery', () => {
  it('defaults to active items, 25 per page', () => {
    expect(listQuery.parse({})).toEqual({ status: 'active', limit: 25 });
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it('coerces the limit from a query string and bounds it to 1..100', () => {
    expect(listQuery.parse({ limit: '40' }).limit).toBe(40);
    expect(listQuery.parse({ limit: '100' }).limit).toBe(MAX_PAGE_SIZE);
    for (const limit of ['0', '101', '-1', '2.5', 'abc']) {
      expect(listQuery.safeParse({ limit }).success).toBe(false);
    }
  });

  it('takes a status and an opaque cursor', () => {
    expect(listQuery.parse({ status: 'archived', cursor: 'MjAyNi0xMC0yOQ_abc-123' })).toMatchObject(
      {
        status: 'archived',
        cursor: 'MjAyNi0xMC0yOQ_abc-123',
      },
    );
    expect(listQuery.safeParse({ status: 'all' }).success).toBe(false);
  });

  it('has no skip: offset paging does not exist', () => {
    expect(listQuery.parse({ skip: '20' })).not.toHaveProperty('skip');
  });
});

describe('cursor', () => {
  it('is base64url only and bounded', () => {
    expect(cursor.safeParse('abc_DEF-123').success).toBe(true);
    expect(cursor.safeParse('has space').success).toBe(false);
    expect(cursor.safeParse('pad==').success).toBe(false);
    expect(cursor.safeParse('x'.repeat(201)).success).toBe(false);
  });
});

describe('page', () => {
  const numbers = page(z.number());

  it('is { items, nextCursor }', () => {
    expect(numbers.safeParse({ items: [1, 2], nextCursor: null }).success).toBe(true);
    expect(numbers.safeParse({ items: [], nextCursor: 'abc' }).success).toBe(true);
  });

  it('rejects a missing cursor field and wrong items', () => {
    expect(numbers.safeParse({ items: [1] }).success).toBe(false);
    expect(numbers.safeParse({ items: ['x'], nextCursor: null }).success).toBe(false);
  });
});

describe('componentStatus', () => {
  it('is active or archived', () => {
    expect(componentStatus.safeParse('active').success).toBe(true);
    expect(componentStatus.safeParse('archived').success).toBe(true);
    expect(componentStatus.safeParse('deleted').success).toBe(false);
  });
});

describe('isMillimetre', () => {
  it('accepts up to three decimals, tolerating float noise', () => {
    for (const v of [1, 18.288, 0.001, 0.1 + 0.2, 299.999]) expect(isMillimetre(v)).toBe(true);
    for (const v of [18.2884, 0.0005, 1.0001]) expect(isMillimetre(v)).toBe(false);
  });
});
