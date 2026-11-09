import { describe, expect, it } from 'vitest';
import { SANDBOX_SETS } from './real-sets.js';
import { analyse, BENCH_GRID } from './sandbox.logic.js';

const set = (id: 'good' | 'doubtful') => {
  const found = SANDBOX_SETS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no set ${id}`);
  return found;
};

describe('analyse', () => {
  it('passes exactly through every measured mark of both sets', () => {
    for (const candidate of SANDBOX_SETS) {
      const rows = analyse(candidate).rows;
      for (const mark of candidate.marks) {
        const row = rows.find((r) => r.distanceM === mark.distanceM);
        expect(row).toMatchObject({ ok: true, kind: 'measured', reading: mark.reading });
      }
    }
  });

  it('covers the grid from 10 m to 70 m every 5 m, and flags what is estimated', () => {
    const { rows } = analyse(set('good'));
    expect(rows.map((r) => r.distanceM)).toEqual(
      Array.from(
        { length: (BENCH_GRID.to - BENCH_GRID.from) / BENCH_GRID.step + 1 },
        (_, k) => 10 + 5 * k,
      ),
    );
    const at = (d: number) => rows.find((r) => r.distanceM === d);
    expect(at(25)).toMatchObject({ ok: true, kind: 'interpolated' });
    expect(at(10)).toMatchObject({ ok: true, kind: 'extrapolated' });
    expect(at(70)).toMatchObject({ ok: true, kind: 'extrapolated' });
  });

  it('reads further down the scale as the distance grows', () => {
    const readings = analyse(set('good')).rows.flatMap((r) => (r.ok ? [r.reading] : []));
    expect(readings).toEqual([...readings].sort((a, b) => a - b));
  });

  it('marks an extrapolation that falls off the 0-10 cm scale', () => {
    const ten = analyse(set('good')).rows.find((r) => r.distanceM === 10);
    expect(ten).toMatchObject({ ok: true, outOfScale: true });
  });

  it('runs the Doctor on both sets with the five marks it needs', () => {
    for (const candidate of SANDBOX_SETS) {
      const { doctor } = analyse(candidate);
      expect(doctor.level).toBe('full');
      expect(doctor.residuals).toHaveLength(5);
    }
    expect(analyse(set('good')).doctor.status).toBe('ok');
  });
});
