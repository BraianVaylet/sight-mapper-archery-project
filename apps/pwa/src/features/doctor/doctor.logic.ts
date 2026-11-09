import {
  mmToReading,
  type DoctorLevel,
  type DoctorStatus,
  type SightScale,
} from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import type { SightAnalysis } from '../sight/sight.logic.js';

export type DoctorRowState = 'ok' | 'suspect' | 'secondary' | 'inconsistent';

export type DoctorRow = {
  readonly id: string;
  readonly distanceM: number;
  /** What the archer loaded, in scale units. */
  readonly reading: number;
  /** Signed distance from the trend of the other marks, in scale units. Only from 5 marks. */
  readonly deviation: number | undefined;
  /** How far a mark may stand from the trend before it is pointed at, in scale units. */
  readonly tolerance: number | undefined;
  readonly state: DoctorRowState;
};

export type DoctorView = {
  readonly status: DoctorStatus;
  readonly level: DoctorLevel;
  /** Nearest first, one per measured mark. */
  readonly rows: readonly DoctorRow[];
  /** The mark to shoot again, with how far it stands from the trend (signed, in scale units). */
  readonly suspect:
    { readonly id: string; readonly distanceM: number; readonly delta: number } | undefined;
  /** Pairs of neighbouring marks whose readings move the wrong way (from 2 marks). */
  readonly breaks: readonly { readonly fromM: number; readonly toM: number }[];
};

/**
 * What the Mark Doctor says, in the archer's terms (HU-CAL-04): the domain report is in millimetres
 * of scale; here it becomes what they read on the sight. Nothing is changed and nothing is stored
 * (ADR-001): the report is computed again from the marks each time.
 */
export function doctorView(
  marks: readonly Mark[],
  analysis: SightAnalysis,
  scale: SightScale,
): DoctorView {
  const report = analysis.doctor;
  const sorted = [...marks].sort((a, b) => a.distanceM - b.distanceM);
  const byId = new Map(sorted.map((m) => [m.id, m]));
  const toUnits = (mm: number) => mmToReading(mm, scale);

  const residual = new Map((report?.residuals ?? []).map((r) => [r.markId, r]));
  const secondary = new Set(report?.secondary ?? []);

  const rows = sorted.map((mark): DoctorRow => {
    const r = residual.get(mark.id);
    const state: DoctorRowState = analysis.inconsistentIds.has(mark.id)
      ? 'inconsistent'
      : report?.suspect?.markId === mark.id
        ? 'suspect'
        : secondary.has(mark.id)
          ? 'secondary'
          : 'ok';
    return {
      id: mark.id,
      distanceM: mark.distanceM,
      reading: toUnits(mark.scaleValueMm),
      deviation: r === undefined ? undefined : toUnits(r.residualMm),
      tolerance: r === undefined ? undefined : toUnits(r.thresholdMm),
      state,
    };
  });

  const suspectMark = report?.suspect === undefined ? undefined : byId.get(report.suspect.markId);
  return {
    status: report?.status ?? 'insufficient',
    level: report?.level ?? 'none',
    rows,
    suspect:
      report?.suspect === undefined || suspectMark === undefined
        ? undefined
        : {
            id: suspectMark.id,
            distanceM: suspectMark.distanceM,
            delta: toUnits(report.suspect.residualMm),
          },
    breaks: (report?.monotonicity ?? []).flatMap((pair) => {
      const a = byId.get(pair.markIds[0]);
      const b = byId.get(pair.markIds[1]);
      return a === undefined || b === undefined ? [] : [{ fromM: a.distanceM, toM: b.distanceM }];
    }),
  };
}
