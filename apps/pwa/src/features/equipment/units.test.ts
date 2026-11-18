import { ARROW_RANGES, BOW_RANGES } from '@sight-mapper/schemas';
import { describe, expect, it } from 'vitest';
import { readQuantity, showRange } from './units.js';

// Expected values worked out by hand from the canonical ranges (DICCIONARIO §3.1 and §3.3):
// 1 in = 25.4 mm, 1 lb = 4.4482216 N, 1 kgf = 9.80665 N, 1 gr = 0.06479891 g, 1 fps = 0.3048 m/s.
describe('showRange (RN-EQP-03)', () => {
  it('shows the bow in imperial, rounded inward', () => {
    expect(showRange(BOW_RANGES.iboSpeedMps, 'speed', 'imperial', '.')).toBe('148–442'); // 147.6–442.9
    expect(showRange(BOW_RANGES.drawLengthMm, 'length', 'imperial', '.')).toBe('11.9–35.4'); // 11.81–35.43
    expect(showRange(BOW_RANGES.drawWeightN, 'force', 'imperial', '.')).toBe('4.5–101.1'); // 4.496–101.16
    expect(showRange(BOW_RANGES.braceHeightMm, 'length', 'imperial', ',')).toBe('4–10,2'); // 3.94–10.24
    expect(showRange(BOW_RANGES.sightRadiusMm, 'length', 'imperial', '.')).toBe('15.8–47.2'); // 15.75–47.24
  });

  it('shows the bow in metric: whole mm and m/s, kg to one decimal', () => {
    expect(showRange(BOW_RANGES.drawLengthMm, 'length', 'metric', '.')).toBe('300–900');
    expect(showRange(BOW_RANGES.iboSpeedMps, 'speed', 'metric', '.')).toBe('45–135');
    expect(showRange(BOW_RANGES.drawWeightN, 'force', 'metric', ',')).toBe('2,1–45,8'); // 2.04–45.89
  });

  it('shows the arrows in grains and fps', () => {
    expect(showRange(ARROW_RANGES.pointWeightG, 'mass', 'imperial', '.')).toBe('16–462'); // 15.43–462.97
    expect(showRange(ARROW_RANGES.totalWeightG, 'mass', 'imperial', '.')).toBe('155–925'); // 154.3–925.9
    expect(showRange(ARROW_RANGES.measuredSpeedMps, 'speed', 'imperial', '.')).toBe('99–442'); // 98.4–442.9
    expect(showRange(ARROW_RANGES.cutLengthMm, 'length', 'imperial', '.')).toBe('11.9–35.4');
  });

  it('never converts ratings or percentages', () => {
    expect(showRange(ARROW_RANGES.spine, 'rating', 'imperial', '.')).toBe('100–2600');
    expect(showRange(BOW_RANGES.letOffPct, 'percent', 'metric', '.')).toBe('0–99');
  });

  it('never shows a bound the schema refuses: both ends read back inside the range', () => {
    const cases = [
      [BOW_RANGES.iboSpeedMps, 'speed'],
      [BOW_RANGES.drawLengthMm, 'length'],
      [BOW_RANGES.drawWeightN, 'force'],
      [BOW_RANGES.axleToAxleMm, 'length'],
      [BOW_RANGES.braceHeightMm, 'length'],
      [BOW_RANGES.sightRadiusMm, 'length'],
      [BOW_RANGES.peepHeightMm, 'length'],
      [BOW_RANGES.dLoopLengthMm, 'length'],
      [ARROW_RANGES.cutLengthMm, 'length'],
      [ARROW_RANGES.pointWeightG, 'mass'],
      [ARROW_RANGES.totalWeightG, 'mass'],
      [ARROW_RANGES.measuredSpeedMps, 'speed'],
    ] as const;
    for (const system of ['metric', 'imperial'] as const) {
      for (const [range, quantity] of cases) {
        const [low, high] = showRange(range, quantity, system, '.').split('–') as [string, string];
        for (const end of [low, high]) {
          const canonical = readQuantity(end, quantity, system) ?? Number.NaN;
          expect(canonical).toBeGreaterThanOrEqual(range[0] - 1e-9);
          expect(canonical).toBeLessThanOrEqual(range[1] + 1e-9);
        }
      }
    }
  });
});
