import { describe, expect, it } from 'vitest';
import {
  arrowSet,
  bow,
  componentUsage,
  createArrowSet,
  createBow,
  createSight,
  sight,
  sightScale,
  updateArrowSet,
  updateBow,
  updateSight,
} from './equipment.js';
import { customScale, ID, resource, UUID_V4 } from '../test/fixtures.js';

const okBow = { id: ID.a, bowType: 'compound', manufacturer: 'Hoyt' } as const;

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((i) => i.path.join('.')) ?? [];

describe('createBow', () => {
  it('accepts the minimum: id, type and a manufacturer or model', () => {
    expect(createBow.safeParse(okBow).success).toBe(true);
    expect(createBow.safeParse({ ...okBow, manufacturer: undefined, model: 'RX-7' }).success).toBe(
      true,
    );
  });

  it('needs a manufacturer or a model', () => {
    const result = createBow.safeParse({ id: ID.a, bowType: 'compound', nickname: 'Mine' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(['manufacturer']);
    expect(result.error?.issues[0]?.message).toBe('validation.equipment.manufacturerOrModel');
  });

  it('requires a UUIDv7 id', () => {
    expect(createBow.safeParse({ ...okBow, id: UUID_V4 }).success).toBe(false);
    expect(createBow.safeParse({ ...okBow, id: 'not-a-uuid' }).success).toBe(false);
    expect(createBow.safeParse({ manufacturer: 'Hoyt', bowType: 'compound' }).success).toBe(false);
  });

  it('knows every bow type; the API decides which are supported', () => {
    for (const bowType of ['compound', 'recurve', 'crossbow']) {
      expect(createBow.safeParse({ ...okBow, bowType }).success).toBe(true);
    }
    expect(createBow.safeParse({ ...okBow, bowType: 'longbow' }).success).toBe(false);
  });

  it('accepts null to mean "not set"', () => {
    expect(createBow.safeParse({ ...okBow, nickname: null, drawLengthMm: null }).success).toBe(
      true,
    );
  });

  it('trims text and rejects an empty name', () => {
    expect(createBow.parse({ ...okBow, nickname: '  Archie  ' }).nickname).toBe('Archie');
    expect(createBow.safeParse({ ...okBow, nickname: '   ' }).success).toBe(false);
  });

  // DICCIONARIO §3.1: [min, max] inclusive, in canonical units
  it.each([
    ['iboSpeedMps', 60, 135],
    ['letOffPct', 0, 99],
    ['drawLengthMm', 450, 900],
    ['drawWeightN', 45, 450],
    ['axleToAxleMm', 500, 1200],
    ['braceHeightMm', 100, 260],
    ['sightRadiusMm', 400, 1200],
    ['peepHeightMm', 20, 250],
    ['dLoopLengthMm', 5, 150],
  ])('%s accepts %d..%d and nothing outside', (field, min, max) => {
    const parse = (value: number) => createBow.safeParse({ ...okBow, [field]: value }).success;
    expect(parse(min)).toBe(true);
    expect(parse(max)).toBe(true);
    expect(parse(min - 0.001)).toBe(false);
    expect(parse(max + 0.001)).toBe(false);
  });

  it.each([
    ['nickname', 40],
    ['manufacturer', 60],
    ['model', 60],
    ['rest', 80],
    ['notes', 500],
  ])('%s is limited to %d characters', (field, max) => {
    const base = { id: ID.a, bowType: 'compound', model: 'RX' };
    expect(createBow.safeParse({ ...base, [field]: 'x'.repeat(max) }).success).toBe(true);
    expect(createBow.safeParse({ ...base, [field]: 'x'.repeat(max + 1) }).success).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    expect(createBow.safeParse({ ...okBow, drawWeightN: Number.NaN }).success).toBe(false);
    expect(createBow.safeParse({ ...okBow, drawWeightN: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
  });

  it('accepts a cam type from the dictionary only', () => {
    expect(createBow.safeParse({ ...okBow, camType: 'hybrid' }).success).toBe(true);
    expect(createBow.safeParse({ ...okBow, camType: 'round' }).success).toBe(false);
  });
});

describe('updateBow', () => {
  it('is a partial edit', () => {
    expect(updateBow.safeParse({}).success).toBe(true);
    expect(updateBow.safeParse({ letOffPct: 80 }).success).toBe(true);
    expect(updateBow.safeParse({ letOffPct: 100 }).success).toBe(false);
  });

  it('clears an optional field with null', () => {
    expect(updateBow.parse({ rest: null })).toEqual({ rest: null });
  });
});

describe('bow (response)', () => {
  it('parses a stored bow', () => {
    expect(bow.safeParse({ ...resource, ...okBow, status: 'active' }).success).toBe(true);
  });

  it('needs the resource fields and a status', () => {
    expect(bow.safeParse({ ...okBow, status: 'active' }).success).toBe(false);
    expect(bow.safeParse({ ...resource, ...okBow }).success).toBe(false);
    expect(bow.safeParse({ ...resource, ...okBow, status: 'deleted' }).success).toBe(false);
    expect(bow.safeParse({ ...resource, ...okBow, status: 'active', version: 0 }).success).toBe(
      false,
    );
    expect(
      bow.safeParse({ ...resource, ...okBow, status: 'active', createdAt: 'yesterday' }).success,
    ).toBe(false);
  });
});

describe('sightScale', () => {
  it('accepts a custom 1-9 scale', () => {
    expect(sightScale.safeParse(customScale).success).toBe(true);
  });

  it('defaults the direction to down', () => {
    const withoutDirection = { unit: 'custom', unitSizeMm: 10, min: 1, max: 9, resolution: 0.1 };
    expect(sightScale.parse(withoutDirection).direction).toBe('down');
  });

  it('puts min >= max on scale.max', () => {
    for (const max of [1, 0.5]) {
      const result = createSight.safeParse({
        id: ID.a,
        model: 'Shibuya',
        scale: { ...customScale, max },
      });
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toEqual(['scale.max']);
      expect(result.error?.issues[0]?.message).toBe('validation.scale.minLessThanMax');
    }
  });

  it('keeps the resolution within the travel', () => {
    const tooFine = sightScale.safeParse({ ...customScale, resolution: 8.1 });
    expect(tooFine.success).toBe(false);
    expect(tooFine.error?.issues[0]?.path).toEqual(['resolution']);
    expect(tooFine.error?.issues[0]?.message).toBe('validation.scale.resolutionTooLarge');
    expect(sightScale.safeParse({ ...customScale, resolution: 8 }).success).toBe(true);
    expect(sightScale.safeParse({ ...customScale, resolution: 0 }).success).toBe(false);
    expect(sightScale.safeParse({ ...customScale, resolution: -1 }).success).toBe(false);
  });

  it('does not stack the resolution error on a reversed range', () => {
    const result = sightScale.safeParse({ ...customScale, min: 9, max: 1, resolution: 50 });
    expect(result.error?.issues).toHaveLength(1);
  });

  it('allows a physical size or none for click and custom', () => {
    expect(sightScale.safeParse({ ...customScale, unitSizeMm: null }).success).toBe(true);
    expect(sightScale.safeParse({ ...customScale, unit: 'click', unitSizeMm: 0.5 }).success).toBe(
      true,
    );
    expect(sightScale.safeParse({ ...customScale, unitSizeMm: 0 }).success).toBe(false);
    expect(sightScale.safeParse({ ...customScale, unitSizeMm: -2 }).success).toBe(false);
  });

  it.each([
    ['mm', 1],
    ['cm', 10],
    ['in', 25.4],
  ])('%s has a fixed size of %d mm', (unit, size) => {
    const scale = { ...customScale, unit, min: 0, max: 100, resolution: 1 };
    expect(sightScale.safeParse({ ...scale, unitSizeMm: null }).success).toBe(true);
    expect(sightScale.safeParse({ ...scale, unitSizeMm: size }).success).toBe(true);
    const wrong = sightScale.safeParse({ ...scale, unitSizeMm: size + 1 });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues[0]?.path).toEqual(['unitSizeMm']);
    expect(wrong.error?.issues[0]?.message).toBe('validation.sight.fixedUnitSize');
  });

  it('rejects an unknown unit or direction', () => {
    expect(sightScale.safeParse({ ...customScale, unit: 'moa' }).success).toBe(false);
    expect(sightScale.safeParse({ ...customScale, direction: 'left' }).success).toBe(false);
  });
});

describe('createSight / updateSight / sight', () => {
  const okSight = { id: ID.a, manufacturer: 'Axcel', scale: customScale };

  it('defaults to a monopin', () => {
    expect(createSight.parse(okSight).pinType).toBe('monopin');
  });

  it('needs a manufacturer or a model, and a scale', () => {
    expect(createSight.safeParse({ id: ID.a, scale: customScale }).success).toBe(false);
    expect(createSight.safeParse({ id: ID.a, model: 'X' }).success).toBe(false);
  });

  it('takes a pin type from the dictionary', () => {
    expect(createSight.safeParse({ ...okSight, pinType: 'multipin' }).success).toBe(true);
    expect(createSight.safeParse({ ...okSight, pinType: 'tripin' }).success).toBe(false);
  });

  it('updates partially, with a strategy when the scale changes', () => {
    expect(updateSight.safeParse({}).success).toBe(true);
    expect(updateSight.safeParse({ nickname: 'Dial' }).success).toBe(true);
    expect(
      updateSight.safeParse({ scale: customScale, scaleChangeStrategy: 'keepReadings' }).success,
    ).toBe(true);
    expect(updateSight.safeParse({ scaleChangeStrategy: 'keepEverything' }).success).toBe(false);
  });

  it('does not re-apply the pin default on a partial edit', () => {
    expect(updateSight.parse({ nickname: 'Dial' })).toEqual({ nickname: 'Dial' });
  });

  it('parses a stored sight', () => {
    expect(
      sight.safeParse({ ...resource, ...okSight, pinType: 'monopin', status: 'active' }).success,
    ).toBe(true);
  });
});

describe('arrow sets', () => {
  const ok = { id: ID.a, name: 'Easton X10' };

  it('needs only a name', () => {
    expect(createArrowSet.safeParse(ok).success).toBe(true);
    expect(createArrowSet.safeParse({ id: ID.a }).success).toBe(false);
    expect(createArrowSet.safeParse({ id: ID.a, name: ' ' }).success).toBe(false);
  });

  it.each([
    ['spine', 100, 2000],
    ['cutLengthMm', 400, 900],
    ['gpi', 2, 30],
    ['pointWeightG', 1, 30],
    ['extraWeightG', 0, 30],
    ['totalWeightG', 10, 60],
    ['measuredSpeedMps', 30, 135],
  ])('%s accepts %d..%d and nothing outside', (field, min, max) => {
    const parse = (value: number) => createArrowSet.safeParse({ ...ok, [field]: value }).success;
    expect(parse(min)).toBe(true);
    expect(parse(max)).toBe(true);
    expect(parse(min - 0.01)).toBe(false);
    expect(parse(max + 0.01)).toBe(false);
  });

  it('vaneCount is an integer from 2 to 6', () => {
    const parse = (value: number) => createArrowSet.safeParse({ ...ok, vaneCount: value }).success;
    expect([1, 2, 3, 6, 7, 3.5].map(parse)).toEqual([false, true, true, true, false, false]);
  });

  it.each([
    ['name', 40],
    ['vaneColor', 30],
    ['nock', 60],
  ])('%s is limited to %d characters', (field, max) => {
    expect(createArrowSet.safeParse({ ...ok, [field]: 'x'.repeat(max) }).success).toBe(true);
    expect(createArrowSet.safeParse({ ...ok, [field]: 'x'.repeat(max + 1) }).success).toBe(false);
  });

  it('updates partially and parses a stored set', () => {
    expect(updateArrowSet.safeParse({ gpi: 9.5 }).success).toBe(true);
    expect(updateArrowSet.safeParse({ gpi: 99 }).success).toBe(false);
    expect(arrowSet.safeParse({ ...resource, ...ok, status: 'archived' }).success).toBe(true);
  });
});

describe('componentUsage', () => {
  it('counts setups and marks', () => {
    expect(componentUsage.safeParse({ setups: 2, marks: 0 }).success).toBe(true);
    expect(componentUsage.safeParse({ setups: -1, marks: 0 }).success).toBe(false);
    expect(componentUsage.safeParse({ setups: 1.5, marks: 0 }).success).toBe(false);
  });
});
