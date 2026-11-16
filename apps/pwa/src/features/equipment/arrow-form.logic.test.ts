import { describe, expect, it } from 'vitest';
import {
  emptyValues,
  toArrowSetInput,
  toArrowSetPatch,
  toFormValues,
  type ArrowFormValues,
} from './arrow-form.logic.js';

const ID = '01927e5a-0000-7000-8000-000000000003';
const named = (over: Partial<ArrowFormValues> = {}): ArrowFormValues => ({
  ...emptyValues(),
  name: 'Hunter 400',
  ...over,
});

const ok = (result: ReturnType<typeof toArrowSetInput>) => {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result;
};

describe('toArrowSetInput (HU-ARW-01)', () => {
  it('needs only a name: everything else is left blank', () => {
    const result = ok(toArrowSetInput(named(), 'metric', ID));
    expect(result.input).toEqual({ id: ID, name: 'Hunter 400' });
    expect(result.clears).toContain('spine');
    expect(result.clears).not.toContain('name');
  });

  it('keeps metric values as typed: grams, mm, m/s and ratings', () => {
    const { input } = ok(
      toArrowSetInput(
        named({
          spine: '400',
          gpi: '8,5',
          cutLengthMm: '740',
          pointWeightG: '5,6',
          measuredSpeedMps: '83,2',
          vaneCount: '3',
        }),
        'metric',
        ID,
      ),
    );
    expect(input).toMatchObject({
      spine: 400,
      gpi: 8.5,
      cutLengthMm: 740,
      pointWeightG: 5.6,
      measuredSpeedMps: 83.2,
      vaneCount: 3,
    });
  });

  it('converts imperial values: 29 1/8 in is 739.78 mm, 100 gr is 6.48 g, 270 fps is 82.30 m/s', () => {
    const { input } = ok(
      toArrowSetInput(
        named({
          cutLengthMm: '29 1/8',
          pointWeightG: '100',
          measuredSpeedMps: '270',
          spine: '400',
        }),
        'imperial',
        ID,
      ),
    );
    expect(input.cutLengthMm).toBeCloseTo(739.775, 2);
    expect(input.pointWeightG).toBeCloseTo(6.4799, 3);
    expect(input.measuredSpeedMps).toBeCloseTo(82.296, 3);
    // A rating is the same in both systems.
    expect(input.spine).toBe(400);
  });

  it('asks for the name on its own field', () => {
    const result = toArrowSetInput(named({ name: '  ' }), 'metric', ID);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors['name']?.messageKey).toBe('validation.required');
  });

  it('says which field is out of range or not a number', () => {
    const result = toArrowSetInput(named({ spine: '20', gpi: 'pesado' }), 'metric', ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['spine']?.messageKey).toBe('validation.too_small');
      expect(result.errors['gpi']?.messageKey).toBe('validation.arrow.number');
    }
  });

  it('rejects a vane count that is not a whole number', () => {
    expect(toArrowSetInput(named({ vaneCount: '3,5' }), 'metric', ID).ok).toBe(false);
  });
});

describe('toFormValues', () => {
  const stored = { name: 'Hunter 400', spine: 400, pointWeightG: 6.4799, cutLengthMm: 739.775 };

  it('shows metric as typed, with the separator of the language', () => {
    expect(toFormValues(stored, 'metric', ',')).toMatchObject({
      name: 'Hunter 400',
      spine: '400',
      pointWeightG: '6,48',
    });
  });

  it('shows imperial as grains and inches', () => {
    const values = toFormValues(stored, 'imperial', '.');
    expect(values.pointWeightG).toBe('100');
    expect(values.cutLengthMm).toBe('29.13');
  });

  it('starts a new set blank', () => {
    expect(toFormValues(undefined, 'metric', '.')).toEqual(emptyValues());
  });
});

describe('toArrowSetPatch', () => {
  it('leaves out the id, keeps what is filled and nulls what was cleared', () => {
    const patch = toArrowSetPatch(ok(toArrowSetInput(named({ spine: '400' }), 'metric', ID)));
    expect(patch).not.toHaveProperty('id');
    expect(patch).toMatchObject({ name: 'Hunter 400', spine: 400, gpi: null, notes: null });
  });
});
