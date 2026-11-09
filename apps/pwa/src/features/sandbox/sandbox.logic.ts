import {
  calculateGrid,
  createMarkModel,
  diagnose,
  mmToReading,
  readingToMm,
  roundReading,
  scaleBoundsMm,
  type CalcErrorCode,
  type DoctorReport,
  type MarkKind,
} from '@sight-mapper/domain';
import { SANDBOX_SCALE, type SandboxSet } from './real-sets.js';

export type DisplayRow =
  | {
      readonly ok: true;
      readonly distanceM: number;
      readonly kind: MarkKind;
      readonly reading: number;
      readonly lowConfidence: boolean;
      readonly outOfScale: boolean;
    }
  | {
      readonly ok: false;
      readonly distanceM: number;
      readonly code: CalcErrorCode;
      readonly params: Readonly<Record<string, number>>;
    };

export type Analysis = {
  readonly rows: readonly DisplayRow[];
  readonly doctor: DoctorReport;
};

/** The grid the bench shows: every 5 m from 10 to 70, so both extrapolations appear. */
export const BENCH_GRID = { from: 10, to: 70, step: 5 } as const;

/**
 * What the app does with a set of marks, with no screen in the way: readings to mm, the model,
 * the grid and the Doctor (the numbers the archer sees are always `domain` then `convert`).
 */
export function analyse(set: SandboxSet): Analysis {
  const points = set.marks.map((mark) => ({
    distanceM: mark.distanceM,
    valueMm: readingToMm(mark.reading, SANDBOX_SCALE),
  }));
  const model = createMarkModel(points);

  const rows = calculateGrid(model, {
    ...BENCH_GRID,
    unitToMeters: 1,
    scale: scaleBoundsMm(SANDBOX_SCALE),
  }).map((row): DisplayRow => {
    if (!row.ok) return { ok: false, distanceM: row.distanceM, code: row.code, params: row.params };
    return {
      ok: true,
      distanceM: row.distanceM,
      kind: row.kind,
      reading: roundReading(mmToReading(row.scaleValueMm, SANDBOX_SCALE), SANDBOX_SCALE),
      lowConfidence: row.lowConfidence,
      outOfScale: row.outOfScale,
    };
  });

  const doctor = diagnose(
    points.map((point) => ({ id: String(point.distanceM), ...point })),
    {
      direction: SANDBOX_SCALE.direction,
      quantumMm: readingToMm(SANDBOX_SCALE.resolution, SANDBOX_SCALE),
    },
  );
  return { rows, doctor };
}
