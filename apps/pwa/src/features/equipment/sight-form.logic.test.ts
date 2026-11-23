import { describe, expect, it } from 'vitest';
import {
  emptyValues,
  previewScale,
  toFormValues,
  toSightInput,
  toSightPatch,
  travelMm,
  withWindageCopy,
  type SightFormValues,
} from './sight-form.logic.js';

const ID = '01927e5a-0000-7000-8000-000000000002';

const cm = (over: Partial<SightFormValues> = {}): SightFormValues => ({
  ...emptyValues(),
  manufacturer: 'Sight Master',
  model: 'Ultraview',
  unit: 'cm',
  min: '0',
  max: '10',
  resolution: '0,1',
  ...over,
});

const ok = (result: ReturnType<typeof toSightInput>) => {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  return result;
};

describe('toSightInput (HU-SGT-01)', () => {
  it('builds the scale of the author sight: cm, 0 to 10, down, resolution 0.1', () => {
    const { input } = ok(toSightInput(cm(), ID));
    expect(input).toMatchObject({
      id: ID,
      pinType: 'monopin',
      scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' },
    });
    expect(input.scale).not.toHaveProperty('unitSizeMm');
  });

  it('custom 1 to 9 with 80 mm between them is 10 mm per unit', () => {
    const { input } = ok(
      toSightInput(
        cm({ unit: 'custom', min: '1', max: '9', lengthMm: '80', resolution: '0,5' }),
        ID,
      ),
    );
    expect(input.scale.unitSizeMm).toBe(10);
  });

  it('prefers the unit size when the archer knows it, over the length', () => {
    const { input } = ok(
      toSightInput(cm({ unit: 'custom', unitSizeMm: '8,5', lengthMm: '80' }), ID),
    );
    expect(input.scale.unitSizeMm).toBe(8.5);
  });

  it('lets a click scale be saved without knowing the size of a click', () => {
    const { input } = ok(
      toSightInput(cm({ unit: 'click', min: '0', max: '100', resolution: '1' }), ID),
    );
    expect(input.scale.unit).toBe('click');
    expect(input.scale).not.toHaveProperty('unitSizeMm');
  });

  it('ignores a size typed for a fixed unit instead of sending it', () => {
    const { input } = ok(toSightInput(cm({ unitSizeMm: '7', lengthMm: '70' }), ID));
    expect(input.scale).not.toHaveProperty('unitSizeMm');
  });

  it('keeps the direction the archer chose', () => {
    const { input } = ok(toSightInput(cm({ direction: 'up' }), ID));
    expect(input.scale.direction).toBe('up');
  });

  it('lists blank text fields as clears', () => {
    const result = ok(toSightInput(cm({ nickname: ' Mía ' }), ID));
    expect(result.input.nickname).toBe('Mía');
    expect(result.clears).toEqual(['notes']);
  });
});

describe('toSightInput: what it refuses, on which field', () => {
  const errorsOf = (values: SightFormValues) => {
    const result = toSightInput(values, ID);
    if (result.ok) throw new Error('expected errors');
    return Object.fromEntries(Object.entries(result.errors).map(([k, v]) => [k, v?.messageKey]));
  };

  it('puts "minimum not below maximum" on the maximum field (HU-SGT-01)', () => {
    expect(errorsOf(cm({ min: '10', max: '10' }))).toEqual({
      max: 'validation.scale.minLessThanMax',
    });
  });

  it('refuses a resolution larger than the travel, on the resolution', () => {
    expect(errorsOf(cm({ resolution: '11' }))).toEqual({
      resolution: 'validation.scale.resolutionTooLarge',
    });
  });

  it('says a word is not a number, on its own field', () => {
    expect(errorsOf(cm({ min: 'cero' }))).toMatchObject({ min: 'validation.sight.number' });
  });

  it('needs min, max and resolution', () => {
    const errors = errorsOf(cm({ min: '', max: '', resolution: '' }));
    expect(Object.keys(errors).sort()).toEqual(['max', 'min', 'resolution']);
  });

  it('needs a maker or a model', () => {
    expect(errorsOf(cm({ manufacturer: '', model: '' }))).toEqual({
      manufacturer: 'validation.equipment.manufacturerOrModel',
    });
  });
});

describe('toFormValues', () => {
  const stored = {
    manufacturer: 'Sight Master',
    pinType: 'dualpin' as const,
    scale: {
      unit: 'custom' as const,
      unitSizeMm: 10,
      min: 1,
      max: 9,
      resolution: 0.5,
      direction: 'up' as const,
    },
  };

  it('shows the scale as the archer typed it, with the decimal separator of the language', () => {
    const values = toFormValues(stored, ',');
    expect(values).toMatchObject({
      unit: 'custom',
      unitSizeMm: '10',
      min: '1',
      max: '9',
      resolution: '0,5',
      direction: 'up',
      pinType: 'dualpin',
    });
  });

  it('does not show the fixed size of mm, cm and in as if the archer had typed it', () => {
    const values = toFormValues(
      { ...stored, scale: { ...stored.scale, unit: 'cm', unitSizeMm: 10 } },
      '.',
    );
    expect(values.unitSizeMm).toBe('');
  });

  it('starts a new sight on mm, growing downward, monopin', () => {
    expect(toFormValues(undefined, '.')).toMatchObject({
      unit: 'mm',
      direction: 'down',
      pinType: 'monopin',
    });
  });

  it('starts a new sight on inches when the sight section is imperial (RF-ACC-04)', () => {
    expect(toFormValues(undefined, '.', 'in').unit).toBe('in');
  });

  it('keeps the unit of a saved sight whatever the sight section says', () => {
    const saved = { scale: { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' } };
    expect(toFormValues(saved as never, '.', 'in').unit).toBe('cm');
  });
});

describe('travelMm and previewScale', () => {
  it('shows the travel of the author sight: 0 to 10 cm is 100 mm', () => {
    expect(travelMm(cm())).toBe(100);
  });

  it('is unknown for a click scale without a size ("sin tamaño de click")', () => {
    expect(travelMm(cm({ unit: 'click' }))).toBeUndefined();
  });

  it('is unknown while the numbers do not make a scale', () => {
    expect(travelMm(cm({ max: '' }))).toBeUndefined();
    expect(previewScale(cm({ min: '10', max: '1' }))).toBeUndefined();
  });

  it('gives the preview the scale the form describes', () => {
    expect(previewScale(cm({ direction: 'up' }))).toEqual({
      unit: 'cm',
      unitSizeMm: null,
      min: 0,
      max: 10,
      resolution: 0.1,
      direction: 'up',
    });
  });
});

describe('toSightPatch', () => {
  it('leaves out the id, keeps the scale whole and nulls what was cleared', () => {
    const patch = toSightPatch(ok(toSightInput(cm(), ID)));
    expect(patch).not.toHaveProperty('id');
    expect(patch).toMatchObject({ scale: { unit: 'cm' }, nickname: null, notes: null });
  });
});

describe('the horizontal scale (F1-42)', () => {
  const windage = (over: Partial<SightFormValues['windage']> = {}) => ({
    ...emptyValues().windage,
    min: '-10',
    max: '10',
    resolution: '0,5',
    ...over,
  });

  it('starts a new sight with an empty horizontal block on the same unit, growing right', () => {
    expect(emptyValues('in').windage).toEqual({
      unit: 'in',
      direction: 'right',
      min: '',
      max: '',
      resolution: '',
      unitSizeMm: '',
      lengthMm: '',
    });
  });

  it('copies the vertical scale into the horizontal one, growing right', () => {
    const copied = withWindageCopy(cm({ direction: 'up', unitSizeMm: '8' }));
    expect(copied.windage).toEqual({
      unit: 'cm',
      direction: 'right',
      min: '0',
      max: '10',
      resolution: '0,1',
      unitSizeMm: '8',
      lengthMm: '',
    });
  });

  it('sends the horizontal scale it was given, read with the comma of the language', () => {
    const { input } = ok(toSightInput(cm({ windage: windage({ unit: 'mm' }) }), ID));
    expect(input.windageScale).toEqual({
      unit: 'mm',
      min: -10,
      max: 10,
      resolution: 0.5,
      direction: 'right',
    });
  });

  it('asks for it on a new sight, on the horizontal fields', () => {
    const result = toSightInput(cm(), ID, { requireWindage: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors['windage.min']?.messageKey).toBe('validation.required');
  });

  it('lets an older sight be saved with the horizontal block still empty', () => {
    const { input } = ok(toSightInput(cm(), ID, { requireWindage: false }));
    expect(input.windageScale).toBeNull();
    expect(toSightPatch({ input, clears: [] })).not.toHaveProperty('windageScale');
  });

  it('puts the errors of the horizontal scale on its own fields', () => {
    const result = toSightInput(cm({ windage: windage({ min: '10', max: '0' }) }), ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['windage.max']?.messageKey).toBe('validation.scale.minLessThanMax');
      expect(result.errors['max']).toBeUndefined();
    }
  });

  it('shows the saved horizontal scale, and an empty block for a sight without one', () => {
    const scale = { unit: 'cm', min: 0, max: 10, resolution: 0.1, direction: 'down' } as const;
    const saved = toFormValues(
      { scale, windageScale: { unit: 'mm', min: -5, max: 5, resolution: 0.5, direction: 'left' } },
      ',',
    );
    expect(saved.windage).toMatchObject({
      unit: 'mm',
      min: '-5',
      max: '5',
      resolution: '0,5',
      direction: 'left',
    });
    const older = toFormValues({ scale, windageScale: null }, ',');
    expect(older.windage).toMatchObject({ unit: 'cm', direction: 'right', min: '', max: '' });
  });
});
