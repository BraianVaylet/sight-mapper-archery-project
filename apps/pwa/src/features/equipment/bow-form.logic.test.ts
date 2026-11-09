import { describe, expect, it } from 'vitest';
import {
  emptyValues,
  toBowInput,
  toBowPatch,
  toFormValues,
  unitOf,
  type BowFormValues,
} from './bow-form.logic.js';

const ID = '01927e5a-0000-7000-8000-000000000001';

const filled = (over: Partial<BowFormValues> = {}): BowFormValues => ({
  ...emptyValues(),
  manufacturer: 'Hoyt',
  model: 'Alpha',
  ...over,
});

const ok = (result: ReturnType<typeof toBowInput>) => {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result;
};

describe('toBowInput: canonical units from what the archer typed', () => {
  it('keeps metric values as they are: mm, kg to N, m/s', () => {
    const { input } = ok(
      toBowInput(
        filled({
          braceHeightMm: '158,75',
          drawWeightN: '27',
          iboSpeedMps: '103.5',
          letOffPct: '80',
        }),
        'metric',
        ID,
      ),
    );
    expect(input).toMatchObject({ braceHeightMm: 158.75, iboSpeedMps: 103.5, letOffPct: 80 });
    // 27 kgf x 9.80665 = 264.78 N
    expect(input.drawWeightN).toBeCloseTo(264.78, 2);
  });

  it('accepts a fraction in imperial lengths: 6 1/4 in is 158.75 mm (HU-BOW-01)', () => {
    const { input } = ok(toBowInput(filled({ braceHeightMm: '6 1/4' }), 'imperial', ID));
    expect(input.braceHeightMm).toBe(158.75);
  });

  it('converts imperial draw weight and speed: 60 lb is 266.89 N, 300 fps is 91.44 m/s', () => {
    const { input } = ok(
      toBowInput(filled({ drawWeightN: '60', iboSpeedMps: '300' }), 'imperial', ID),
    );
    expect(input.drawWeightN).toBeCloseTo(266.89, 2);
    expect(input.iboSpeedMps).toBeCloseTo(91.44, 2);
  });

  it('does not accept fractions where they make no sense (metric)', () => {
    const result = toBowInput(filled({ braceHeightMm: '6 1/4' }), 'metric', ID);
    expect(result.ok).toBe(false);
  });

  it('always makes a compound bow with the given id, trimming text', () => {
    const { input } = ok(
      toBowInput(filled({ nickname: '  Mi arco ', camType: 'hybrid' }), 'metric', ID),
    );
    expect(input).toMatchObject({
      id: ID,
      bowType: 'compound',
      nickname: 'Mi arco',
      manufacturer: 'Hoyt',
      camType: 'hybrid',
    });
  });

  it('lists the blank fields as clears, so an edit can send null for them', () => {
    const result = ok(toBowInput(filled({ letOffPct: '80' }), 'metric', ID));
    expect(result.clears).toContain('nickname');
    expect(result.clears).toContain('braceHeightMm');
    expect(result.clears).not.toContain('letOffPct');
    expect(result.clears).not.toContain('manufacturer');
    expect(result.input).not.toHaveProperty('nickname');
  });
});

describe('toBowInput: what it refuses, field by field', () => {
  it('needs a manufacturer or a model (HU-BOW-01)', () => {
    const result = toBowInput(emptyValues(), 'metric', ID);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.errors['manufacturer']?.messageKey).toBe(
        'validation.equipment.manufacturerOrModel',
      );
    }
    expect(toBowInput(filled({ manufacturer: '', model: 'Alpha' }), 'metric', ID).ok).toBe(true);
  });

  it('refuses a let-off of 120 % on that field (HU-BOW-01)', () => {
    const result = toBowInput(filled({ letOffPct: '120' }), 'metric', ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors['letOffPct']?.messageKey).toBe('validation.too_big');
  });

  it('says a typed word is not a number, on its own field', () => {
    const result = toBowInput(filled({ drawLengthMm: 'long', braceHeightMm: '158' }), 'metric', ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['drawLengthMm']?.messageKey).toBe('validation.bow.number');
      expect(result.errors['braceHeightMm']).toBeUndefined();
    }
  });

  it('checks the range after converting: 20 in of brace height is out of range, 6 in is fine', () => {
    expect(toBowInput(filled({ braceHeightMm: '20' }), 'imperial', ID).ok).toBe(false);
    expect(toBowInput(filled({ braceHeightMm: '6' }), 'imperial', ID).ok).toBe(true);
  });
});

describe('toFormValues: the stored bow as text in the archer system', () => {
  const stored = {
    manufacturer: 'Hoyt',
    braceHeightMm: 158.75,
    drawWeightN: 266.893,
    iboSpeedMps: 91.44,
    letOffPct: 80,
  };

  it('shows metric as mm, kg and m/s with the decimal separator of the language', () => {
    const values = toFormValues(stored, 'metric', ',');
    expect(values.braceHeightMm).toBe('158,75');
    expect(values.drawWeightN).toBe('27,22');
    expect(values.iboSpeedMps).toBe('91,44');
    expect(values.letOffPct).toBe('80');
  });

  it('shows imperial as in, lb and fps', () => {
    const values = toFormValues(stored, 'imperial', '.');
    expect(values.braceHeightMm).toBe('6.25');
    expect(values.drawWeightN).toBe('60');
    expect(values.iboSpeedMps).toBe('300');
  });

  it('leaves what is not stored blank, and a new bow all blank', () => {
    expect(toFormValues(stored, 'metric', '.').nickname).toBe('');
    expect(toFormValues(undefined, 'metric', '.')).toEqual(emptyValues());
  });

  it('survives a round trip through the form without drifting', () => {
    const { input } = ok(toBowInput(toFormValues(stored, 'imperial', '.'), 'imperial', ID));
    expect(input.braceHeightMm).toBe(158.75);
    expect(input.drawWeightN).toBeCloseTo(266.89, 1);
  });
});

describe('unitOf', () => {
  it('names the unit the field shows in each system', () => {
    expect(unitOf('length', 'metric')).toBe('mm');
    expect(unitOf('length', 'imperial')).toBe('in');
    expect(unitOf('force', 'metric')).toBe('kg');
    expect(unitOf('force', 'imperial')).toBe('lb');
    expect(unitOf('speed', 'imperial')).toBe('fps');
    expect(unitOf('percent', 'metric')).toBe('%');
  });
});

describe('toBowPatch', () => {
  it('leaves the id out (it is in the path), keeps what is filled and nulls what was cleared', () => {
    const result = ok(toBowInput(filled({ letOffPct: '80' }), 'metric', ID));
    const patch = toBowPatch(result);
    expect(patch).not.toHaveProperty('id');
    expect(patch).toMatchObject({
      manufacturer: 'Hoyt',
      letOffPct: 80,
      nickname: null,
      rest: null,
    });
  });
});
