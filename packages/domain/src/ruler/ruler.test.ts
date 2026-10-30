import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors.js';
import { buildRuler, placeMarks, positionOf, type RulerScale } from './ruler.js';

const mm = (min: number, max: number, direction: 'down' | 'up' = 'down'): RulerScale => ({
  unit: 'mm',
  min,
  max,
  direction,
});

describe('buildRuler — levels and exact positions', () => {
  it('mm 0-120 in 600 px: major every 10 mm, no float drift at the end', () => {
    const ticks = buildRuler({ scale: mm(0, 120), lengthPx: 600 });
    const majors = ticks.filter((t) => t.level === 'major');
    expect(majors.map((t) => t.value)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120,
    ]);
    expect(majors.map((t) => t.positionPx)).toEqual(majors.map((t) => t.value * 5));
    expect(ticks.at(-1)).toMatchObject({ value: 120, positionPx: 600 });
    expect(ticks).toHaveLength(121);
  });

  it('mm has minor 1, medium 5, major 10', () => {
    const ticks = buildRuler({ scale: mm(0, 20), lengthPx: 400 });
    const level = (v: number) => ticks.find((t) => t.value === v)?.level;
    expect(level(1)).toBe('minor');
    expect(level(5)).toBe('medium');
    expect(level(10)).toBe('major');
    expect(level(15)).toBe('medium');
    expect(level(20)).toBe('major');
  });

  it('only major ticks carry a label', () => {
    const ticks = buildRuler({ scale: mm(0, 20), lengthPx: 400 });
    expect(ticks.filter((t) => t.labelled).every((t) => t.level === 'major')).toBe(true);
    expect(ticks.filter((t) => t.labelled).map((t) => t.value)).toEqual([0, 10, 20]);
  });

  it('in has 1/16 minor, 1/4 medium, 1 in major', () => {
    const ticks = buildRuler({
      scale: { unit: 'in', min: 0, max: 2, direction: 'down' },
      lengthPx: 640,
    });
    expect(ticks).toHaveLength(33);
    const level = (v: number) => ticks.find((t) => t.value === v)?.level;
    expect(level(0.0625)).toBe('minor');
    expect(level(0.25)).toBe('medium');
    expect(level(0.75)).toBe('medium');
    expect(level(1)).toBe('major');
    expect(level(2)).toBe('major');
  });

  it('cm and custom have 0.1 minor, 0.5 medium, 1 major', () => {
    for (const unit of ['cm', 'custom'] as const) {
      const ticks = buildRuler({
        scale: { unit, min: 1, max: 3, direction: 'down' },
        lengthPx: 400,
      });
      expect(ticks).toHaveLength(21);
      expect(ticks.find((t) => t.value === 1.3)?.level).toBe('minor');
      expect(ticks.find((t) => t.value === 1.5)?.level).toBe('medium');
      expect(ticks.find((t) => t.value === 2)?.level).toBe('major');
    }
  });

  it('click has 1 minor, 5 medium, 10 major', () => {
    const ticks = buildRuler({
      scale: { unit: 'click', min: 0, max: 30, direction: 'down' },
      lengthPx: 600,
    });
    expect(ticks.find((t) => t.value === 7)?.level).toBe('minor');
    expect(ticks.find((t) => t.value === 15)?.level).toBe('medium');
    expect(ticks.find((t) => t.value === 20)?.level).toBe('major');
  });

  it('starts at the first tick inside the scale when min is not on a tick', () => {
    const ticks = buildRuler({ scale: mm(2.5, 10), lengthPx: 300 });
    expect(ticks[0]?.value).toBe(3);
    expect(ticks[0]?.positionPx).toBeCloseTo(((3 - 2.5) / 7.5) * 300, 9);
    expect(ticks.at(-1)?.value).toBe(10);
  });

  it('handles negative scale values with correct levels', () => {
    const ticks = buildRuler({ scale: mm(-10, 10), lengthPx: 400 });
    expect(ticks.find((t) => t.value === -10)?.level).toBe('major');
    expect(ticks.find((t) => t.value === -5)?.level).toBe('medium');
    expect(ticks.find((t) => t.value === 0)?.level).toBe('major');
  });
});

describe('buildRuler — direction', () => {
  it('down: min at the top', () => {
    const ticks = buildRuler({ scale: mm(0, 100), lengthPx: 500 });
    expect(ticks[0]).toMatchObject({ value: 0, positionPx: 0 });
    expect(ticks.at(-1)).toMatchObject({ value: 100, positionPx: 500 });
  });

  it('up: max at the top, ticks still sorted by position', () => {
    const ticks = buildRuler({ scale: mm(0, 100, 'up'), lengthPx: 500 });
    expect(ticks[0]).toMatchObject({ value: 100, positionPx: 0 });
    expect(ticks.at(-1)).toMatchObject({ value: 0, positionPx: 500 });
    const positions = ticks.map((t) => t.positionPx);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe('buildRuler — density guard', () => {
  it('drops 1 mm ticks when 0-120 mm gets 240 px', () => {
    const ticks = buildRuler({ scale: mm(0, 120), lengthPx: 240 });
    expect(ticks.some((t) => t.level === 'minor')).toBe(false);
    expect(ticks.filter((t) => t.level === 'medium')).toHaveLength(12);
    expect(ticks.filter((t) => t.level === 'major')).toHaveLength(13);
  });

  it('drops medium ticks too when only majors fit', () => {
    const ticks = buildRuler({ scale: mm(0, 120), lengthPx: 90 });
    expect(ticks.map((t) => t.level)).toEqual(Array(13).fill('major'));
  });

  it('keeps a level that sits exactly on the minimum gap', () => {
    const ticks = buildRuler({ scale: mm(0, 100), lengthPx: 400 }); // 4 px per mm
    expect(ticks.some((t) => t.level === 'minor')).toBe(true);
    const tighter = buildRuler({ scale: mm(0, 100), lengthPx: 399 });
    expect(tighter.some((t) => t.level === 'minor')).toBe(false);
  });

  it('honours a custom minimum gap', () => {
    const ticks = buildRuler({ scale: mm(0, 100), lengthPx: 400, minTickGapPx: 8 });
    expect(ticks.some((t) => t.level === 'minor')).toBe(false);
    expect(ticks.some((t) => t.level === 'medium')).toBe(true);
  });

  it('draws nothing when even majors do not fit', () => {
    expect(buildRuler({ scale: mm(0, 1000), lengthPx: 50 })).toEqual([]);
  });

  it('never packs ticks closer than the minimum gap (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 2000 }),
        fc.integer({ min: 10, max: 400 }),
        fc.constantFrom(...(['mm', 'cm', 'in', 'click', 'custom'] as const)),
        (lengthPx, span, unit) => {
          const ticks = buildRuler({
            scale: { unit, min: 0, max: span, direction: 'down' },
            lengthPx,
          });
          // ticks of the same level are never closer than the gap; across levels the finer one drops out
          const byLevel = (l: string) =>
            ticks.filter((t) => t.level === l).map((t) => t.positionPx);
          for (const level of ['minor', 'medium', 'major']) {
            const ps = byLevel(level);
            for (let i = 1; i < ps.length; i++) {
              expect((ps[i] ?? 0) - (ps[i - 1] ?? 0)).toBeGreaterThanOrEqual(4 - 1e-9);
            }
          }
          const all = ticks.map((t) => t.positionPx);
          for (const p of all) {
            expect(p).toBeGreaterThanOrEqual(-1e-9);
            expect(p).toBeLessThanOrEqual(lengthPx + 1e-9);
          }
          for (let i = 1; i < all.length; i++) expect(all[i] ?? 0).toBeGreaterThan(all[i - 1] ?? 0);
        },
      ),
    );
  });
});

describe('buildRuler — guards', () => {
  it.each([
    ['zero length', mm(0, 10), 0],
    ['negative length', mm(0, 10), -5],
    ['NaN length', mm(0, 10), Number.NaN],
    ['min = max', mm(5, 5), 100],
    ['min > max', mm(10, 5), 100],
    ['non-finite min', mm(Number.NaN, 5), 100],
    ['non-finite max', mm(0, Number.POSITIVE_INFINITY), 100],
  ])('throws DomainError for %s', (_label, scale, lengthPx) => {
    expect(() => buildRuler({ scale, lengthPx })).toThrow(DomainError);
  });

  it('rejects a non-positive minimum gap', () => {
    expect(() => buildRuler({ scale: mm(0, 10), lengthPx: 100, minTickGapPx: 0 })).toThrow(
      DomainError,
    );
  });
});

describe('positionOf', () => {
  it('maps a reading to its pixel, honouring direction', () => {
    expect(positionOf(25, mm(0, 100), 400)).toBe(100);
    expect(positionOf(25, mm(0, 100, 'up'), 400)).toBe(300);
  });

  it('does not clip a reading outside the scale', () => {
    expect(positionOf(110, mm(0, 100), 400)).toBe(440);
    expect(positionOf(-10, mm(0, 100), 400)).toBe(-40);
  });

  it('rejects a non-finite reading', () => {
    expect(() => positionOf(Number.NaN, mm(0, 100), 400)).toThrow(DomainError);
  });
});

describe('placeMarks — label anti-overlap', () => {
  const scale = mm(0, 100);

  it('keeps the real position and separates labels of marks 2 px apart', () => {
    const placed = placeMarks(
      scale,
      500,
      [
        { id: 'a', reading: 40 },
        { id: 'b', reading: 40.4 },
      ],
      14,
    );
    expect(placed.map((p) => p.id)).toEqual(['a', 'b']);
    expect(placed[0]?.positionPx).toBe(200);
    expect(placed[1]?.positionPx).toBeCloseTo(202, 9);
    const gap = (placed[1]?.labelPositionPx ?? 0) - (placed[0]?.labelPositionPx ?? 0);
    expect(gap).toBeGreaterThanOrEqual(14);
  });

  it('leaves well separated labels on their real position', () => {
    const placed = placeMarks(
      scale,
      500,
      [
        { id: 'a', reading: 10 },
        { id: 'b', reading: 60 },
      ],
      14,
    );
    for (const p of placed) expect(p.labelPositionPx).toBe(p.positionPx);
  });

  it('sorts by position regardless of input order and direction', () => {
    const marks = [
      { id: 'far', reading: 90 },
      { id: 'near', reading: 10 },
    ];
    expect(placeMarks(scale, 500, marks, 14).map((p) => p.id)).toEqual(['near', 'far']);
    expect(placeMarks(mm(0, 100, 'up'), 500, marks, 14).map((p) => p.id)).toEqual(['far', 'near']);
  });

  it('pulls a cluster at the bottom back inside the ruler', () => {
    const placed = placeMarks(
      scale,
      500,
      [
        { id: 'a', reading: 99.4 },
        { id: 'b', reading: 99.6 },
        { id: 'c', reading: 100 },
      ],
      14,
    );
    const last = placed.at(-1);
    expect(last?.labelPositionPx).toBeLessThanOrEqual(500);
    for (let i = 1; i < placed.length; i++) {
      const gap = (placed[i]?.labelPositionPx ?? 0) - (placed[i - 1]?.labelPositionPx ?? 0);
      expect(gap).toBeGreaterThanOrEqual(14 - 1e-9);
    }
  });

  it('never overlaps labels and never moves the data (property)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 8, max: 24 }),
        (tenths, labelHeight) => {
          const marks = tenths.map((t) => ({ id: `m${t}`, reading: t / 10 }));
          const placed = placeMarks(scale, 600, marks, labelHeight);
          expect(placed).toHaveLength(marks.length);
          for (const p of placed) {
            const reading = Number(p.id.slice(1)) / 10;
            expect(p.positionPx).toBe(positionOf(reading, scale, 600));
          }
          for (let i = 1; i < placed.length; i++) {
            const gap = (placed[i]?.labelPositionPx ?? 0) - (placed[i - 1]?.labelPositionPx ?? 0);
            expect(gap).toBeGreaterThanOrEqual(labelHeight - 1e-9);
          }
        },
      ),
    );
  });

  it('returns nothing for no marks and rejects a bad label height', () => {
    expect(placeMarks(scale, 500, [], 14)).toEqual([]);
    expect(() => placeMarks(scale, 500, [{ id: 'a', reading: 1 }], 0)).toThrow(DomainError);
  });
});
