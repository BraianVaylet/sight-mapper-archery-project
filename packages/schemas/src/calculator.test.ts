import { describe, expect, it } from 'vitest';
import { ID, NOW, resource, UUID_V4 } from '../test/fixtures.js';
import {
  createMark,
  createSetup,
  listMarksQuery,
  mark,
  MAX_MARKS_PER_PAIR,
  setup,
  updateMark,
  updateSetup,
} from './calculator.js';

describe('createSetup', () => {
  const ok = { id: ID.a, bowId: ID.b, sightId: ID.c, arrowSetIds: [ID.d] };

  it('accepts a setup with one arrow set and defaults the rest', () => {
    const parsed = createSetup.parse(ok);
    expect(parsed.isFavorite).toBe(false);
    expect(parsed.name).toBeUndefined();
  });

  it('needs 1..20 arrow sets', () => {
    expect(createSetup.safeParse({ ...ok, arrowSetIds: [] }).success).toBe(false);
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => `019a2f10-0000-7000-8000-${String(i).padStart(12, '0')}`);
    expect(createSetup.safeParse({ ...ok, arrowSetIds: many(20) }).success).toBe(true);
    expect(createSetup.safeParse({ ...ok, arrowSetIds: many(21) }).success).toBe(false);
  });

  it('rejects a repeated arrow set with its own key', () => {
    const result = createSetup.safeParse({ ...ok, arrowSetIds: [ID.d, ID.d] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.setup.duplicateArrowSets');
    expect(result.error?.issues[0]?.path).toEqual(['arrowSetIds']);
  });

  it('needs UUIDv7 ids everywhere', () => {
    for (const field of ['id', 'bowId', 'sightId']) {
      expect(createSetup.safeParse({ ...ok, [field]: UUID_V4 }).success).toBe(false);
    }
    expect(createSetup.safeParse({ ...ok, arrowSetIds: [UUID_V4] }).success).toBe(false);
  });

  it('limits the name to 60 characters', () => {
    expect(createSetup.safeParse({ ...ok, name: 'x'.repeat(60) }).success).toBe(true);
    expect(createSetup.safeParse({ ...ok, name: 'x'.repeat(61) }).success).toBe(false);
    expect(createSetup.safeParse({ ...ok, name: null }).success).toBe(true);
  });
});

describe('updateSetup', () => {
  it('edits name, favourite and arrow sets only', () => {
    expect(updateSetup.safeParse({ isFavorite: true }).success).toBe(true);
    expect(updateSetup.safeParse({ arrowSetIds: [ID.a, ID.b] }).success).toBe(true);
    expect(updateSetup.parse({ bowId: ID.a, name: 'Indoor' })).toEqual({ name: 'Indoor' });
  });

  it('does not re-apply the favourite default', () => {
    expect(updateSetup.parse({})).toEqual({});
  });

  it('keeps the arrow set rules', () => {
    expect(updateSetup.safeParse({ arrowSetIds: [] }).success).toBe(false);
    expect(updateSetup.safeParse({ arrowSetIds: [ID.a, ID.a] }).success).toBe(false);
  });
});

describe('setup (response)', () => {
  it('parses a stored setup', () => {
    const stored = {
      ...resource,
      id: ID.a,
      bowId: ID.b,
      sightId: ID.c,
      arrowSetIds: [ID.d],
      isFavorite: false,
      status: 'active',
    };
    expect(setup.safeParse(stored).success).toBe(true);
    expect(setup.safeParse({ ...stored, status: 'trashed' }).success).toBe(false);
  });
});

describe('createMark', () => {
  const ok = { id: ID.a, setupId: ID.b, arrowSetId: ID.c, distanceM: 40, scaleValueMm: 35 };

  it('accepts the example of TECNICO §5.4 and defaults replace to false', () => {
    const parsed = createMark.parse({ ...ok, measuredAt: '2026-10-29T15:20:00Z', note: null });
    expect(parsed.replace).toBe(false);
  });

  it('takes the distance in metres within (0, 300] at 1 mm resolution', () => {
    const parse = (distanceM: number) => createMark.safeParse({ ...ok, distanceM }).success;
    expect([0.001, 18.288, 70, 300].map(parse)).toEqual([true, true, true, true]);
    expect([0, -5, 300.001, 1000, Number.NaN].map(parse)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('rejects a distance finer than a millimetre with its own key', () => {
    const result = createMark.safeParse({ ...ok, distanceM: 18.2884 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.mark.distancePrecision');
  });

  it('is not fooled by float noise on a millimetre value', () => {
    expect(createMark.safeParse({ ...ok, distanceM: 0.1 + 0.2 }).success).toBe(true);
  });

  it('takes any finite scale position (the fit is checked against the sight)', () => {
    expect(createMark.safeParse({ ...ok, scaleValueMm: 0 }).success).toBe(true);
    expect(createMark.safeParse({ ...ok, scaleValueMm: -3.5 }).success).toBe(true);
    expect(createMark.safeParse({ ...ok, scaleValueMm: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
    expect(createMark.safeParse({ ...ok, scaleValueMm: '35' }).success).toBe(false);
  });

  it('limits the note to 200 characters and allows null', () => {
    expect(createMark.safeParse({ ...ok, note: 'x'.repeat(200) }).success).toBe(true);
    expect(createMark.safeParse({ ...ok, note: 'x'.repeat(201) }).success).toBe(false);
    expect(createMark.safeParse({ ...ok, note: null }).success).toBe(true);
  });

  it('needs ids in UUIDv7 and an ISO date', () => {
    for (const field of ['id', 'setupId', 'arrowSetId']) {
      expect(createMark.safeParse({ ...ok, [field]: UUID_V4 }).success).toBe(false);
    }
    expect(createMark.safeParse({ ...ok, measuredAt: 'yesterday' }).success).toBe(false);
    expect(createMark.safeParse({ ...ok, measuredAt: '2026-10-29T12:20:00-03:00' }).success).toBe(
      true,
    );
  });

  it('never lets the client set the origin', () => {
    expect(createMark.parse({ ...ok, origin: 'seeded' })).not.toHaveProperty('origin');
  });

  it('can ask to replace a mark at the same distance', () => {
    expect(createMark.parse({ ...ok, replace: true }).replace).toBe(true);
  });
});

describe('updateMark', () => {
  it('edits position, distance, note, date or replace', () => {
    expect(updateMark.safeParse({ scaleValueMm: 36 }).success).toBe(true);
    expect(updateMark.safeParse({ distanceM: 45, replace: true }).success).toBe(true);
    expect(updateMark.safeParse({}).success).toBe(true);
  });

  it('keeps the distance rules', () => {
    expect(updateMark.safeParse({ distanceM: 0 }).success).toBe(false);
    expect(updateMark.safeParse({ distanceM: 1.0001 }).success).toBe(false);
  });

  it('cannot move a mark to another setup', () => {
    expect(updateMark.parse({ setupId: ID.a, note: 'x' })).toEqual({ note: 'x' });
  });
});

describe('mark (response)', () => {
  const stored = {
    ...resource,
    id: ID.a,
    setupId: ID.b,
    arrowSetId: ID.c,
    distanceM: 40,
    scaleValueMm: 35,
    origin: 'measured',
    note: null,
    measuredAt: NOW,
  };

  it('parses a stored mark with version 1', () => {
    expect(mark.safeParse(stored).success).toBe(true);
  });

  it('knows the origins and requires the measurement date', () => {
    expect(mark.safeParse({ ...stored, origin: 'seeded' }).success).toBe(true);
    expect(mark.safeParse({ ...stored, origin: 'guessed' }).success).toBe(false);
    expect(mark.safeParse({ ...stored, measuredAt: undefined }).success).toBe(false);
  });
});

describe('listMarksQuery', () => {
  it('needs the arrow set of the pair', () => {
    expect(listMarksQuery.safeParse({ arrowSetId: ID.a }).success).toBe(true);
    expect(listMarksQuery.safeParse({}).success).toBe(false);
    expect(listMarksQuery.safeParse({ arrowSetId: UUID_V4 }).success).toBe(false);
  });

  it('documents the cap of a pair', () => {
    expect(MAX_MARKS_PER_PAIR).toBe(500);
  });
});
