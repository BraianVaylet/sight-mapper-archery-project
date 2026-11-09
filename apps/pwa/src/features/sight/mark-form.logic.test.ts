import type { SightScale } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import { describe, expect, it } from 'vitest';
import {
  fromLocalInput,
  stepDistance,
  stepReading,
  toFormValues,
  toLocalInput,
  toMarkInput,
  type MarkFormContext,
  type MarkFormValues,
} from './mark-form.logic.js';

const IDS = {
  id: '01927e5a-0000-7000-8000-000000000010',
  setupId: '01927e5a-0000-7000-8000-000000000011',
  arrowSetId: '01927e5a-0000-7000-8000-000000000012',
};

/** The author's sight: cm, 0 to 10, steps of 0.1. */
const CM: SightScale = {
  unit: 'cm',
  unitSizeMm: null,
  min: 0,
  max: 10,
  resolution: 0.1,
  direction: 'down',
};
/** HU-MRK-01: custom 1 to 9, 10 mm per unit. */
const CUSTOM: SightScale = {
  unit: 'custom',
  unitSizeMm: 10,
  min: 1,
  max: 9,
  resolution: 0.5,
  direction: 'down',
};

const metric = (scale: SightScale = CM): MarkFormContext => ({
  system: 'metric',
  scale,
  separator: ',',
  distanceUnit: 'm',
});

const values = (over: Partial<MarkFormValues> = {}): MarkFormValues => ({
  distance: '40',
  reading: '1,6',
  note: '',
  measuredAt: '',
  ...over,
});

const errorsOf = (v: MarkFormValues, context = metric()) => {
  const result = toMarkInput(v, IDS, context);
  if (result.ok) throw new Error('expected errors');
  return result.errors;
};

describe('toMarkInput: what the archer typed, in metres and millimetres', () => {
  it('records 40 m and a reading of 3.5 on the custom scale as 35 mm (HU-MRK-01)', () => {
    const result = toMarkInput(values({ reading: '3,5' }), IDS, metric(CUSTOM));
    expect(result).toMatchObject({ ok: true, input: { distanceM: 40, scaleValueMm: 35 } });
  });

  it('turns yards into metres and a comma into a point: 50 yd is 45.72 m', () => {
    const result = toMarkInput(values({ distance: '50' }), IDS, {
      ...metric(),
      system: 'imperial',
    });
    expect(result).toMatchObject({ ok: true, input: { distanceM: 45.72, scaleValueMm: 16 } });
  });

  it('takes a note and a date, and leaves them out when empty', () => {
    const full = toMarkInput(
      values({ note: ' con viento ', measuredAt: '2026-11-03T09:30' }),
      IDS,
      metric(),
    );
    expect(full.ok && full.input.note).toBe('con viento');
    expect(full.ok && full.input.measuredAt).toMatch(/^2026-11-03T/);
    const bare = toMarkInput(values(), IDS, metric());
    expect(bare.ok && 'note' in bare.input).toBe(false);
    expect(bare.ok && 'measuredAt' in bare.input).toBe(false);
  });

  it('carries the ids and whether to replace', () => {
    const result = toMarkInput(values(), { ...IDS, replace: true }, metric());
    expect(result).toMatchObject({ ok: true, input: { ...IDS, replace: true } });
  });
});

describe('toMarkInput: what it refuses, field by field', () => {
  it('asks for the two numbers', () => {
    expect(errorsOf(values({ distance: '', reading: ' ' }))).toEqual({
      distance: { messageKey: 'validation.required', params: {} },
      reading: { messageKey: 'validation.required', params: {} },
    });
  });

  it('says a word is not a number, on its own field', () => {
    const errors = errorsOf(values({ distance: 'lejos', reading: 'x' }));
    expect(errors.distance?.messageKey).toBe('mark.errors.number');
    expect(errors.reading?.messageKey).toBe('mark.errors.number');
  });

  it.each([['0'], ['350'], ['-5']])(
    'refuses the distance %s, naming the limit in the archer unit',
    (d) => {
      expect(errorsOf(values({ distance: d })).distance).toEqual({
        messageKey: 'mark.errors.distanceRange',
        params: { max: '300 m' },
      });
    },
  );

  it('names the limit in yards for an imperial archer: 300 m is 328 yd', () => {
    const errors = errorsOf(values({ distance: '400' }), {
      ...metric(),
      system: 'imperial',
      distanceUnit: 'yd',
    });
    expect(errors.distance?.params).toEqual({ max: '328 yd' });
  });

  it('refuses a reading off the scale and says the range (HU-MRK-01: 9.5 on a 1-9 scale)', () => {
    expect(errorsOf(values({ reading: '9,5' }), metric(CUSTOM)).reading).toEqual({
      messageKey: 'mark.errors.outOfScale',
      params: { min: '1,0', max: '9,0' },
    });
    expect(errorsOf(values({ reading: '10,1' })).reading?.params).toEqual({
      min: '0,0',
      max: '10,0',
    });
  });

  it('accepts the two ends of the scale', () => {
    expect(toMarkInput(values({ reading: '0' }), IDS, metric()).ok).toBe(true);
    expect(toMarkInput(values({ reading: '10' }), IDS, metric()).ok).toBe(true);
  });

  it('refuses a note over 200 characters', () => {
    expect(errorsOf(values({ note: 'x'.repeat(201) })).note?.messageKey).toBe(
      'mark.errors.noteTooLong',
    );
  });
});

describe('toFormValues', () => {
  const saved: Mark = {
    id: IDS.id,
    version: 2,
    createdAt: '2026-11-03T12:00:00Z',
    updatedAt: '2026-11-03T12:00:00Z',
    deletedAt: null,
    setupId: IDS.setupId,
    arrowSetId: IDS.arrowSetId,
    distanceM: 45.72,
    scaleValueMm: 16,
    origin: 'measured',
    note: 'viento',
    measuredAt: '2026-11-03T12:00:00Z',
  };

  it('shows a new mark empty', () => {
    expect(toFormValues(undefined, metric())).toEqual({
      distance: '',
      reading: '',
      note: '',
      measuredAt: '',
    });
  });

  it('shows a saved mark in the archer units: 45.72 m is 50 yd, 16 mm is 1,6 on a cm scale', () => {
    expect(toFormValues(saved, { ...metric(), system: 'imperial' })).toMatchObject({
      distance: '50',
      reading: '1,6',
      note: 'viento',
    });
    expect(toFormValues(saved, metric()).distance).toBe('45,72');
  });
});

describe('the steppers', () => {
  it('moves the reading by one resolution and stops at the ends of the scale', () => {
    expect(stepReading('1,6', 1, metric())).toBe('1,7');
    expect(stepReading('1,6', -1, metric())).toBe('1,5');
    expect(stepReading('10', 1, metric())).toBe('10,0');
    expect(stepReading('0', -1, metric())).toBe('0,0');
  });

  it('does not drift with float error: 0.1 steps up from 0.7 is 0.8', () => {
    let reading = '0';
    for (let i = 0; i < 8; i++) reading = stepReading(reading, 1, metric());
    expect(reading).toBe('0,8');
  });

  it('steps by the resolution of the sight: a half on the custom scale', () => {
    expect(stepReading('3,5', 1, metric(CUSTOM))).toBe('4,0');
    expect(stepReading('', 1, metric(CUSTOM))).toBe('1,5');
  });

  it('moves the distance by one unit and never below one', () => {
    expect(stepDistance('40', 1, metric())).toBe('41');
    expect(stepDistance('1', -1, metric())).toBe('1');
    expect(stepDistance('', 1, metric())).toBe('1');
  });
});

describe('dates for the datetime-local input', () => {
  it('round-trips an instant through the device zone', () => {
    const iso = '2026-11-03T12:34:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it('is empty for nothing, or for something unreadable', () => {
    expect(fromLocalInput('')).toBeUndefined();
    expect(toLocalInput('not a date')).toBe('');
  });
});
