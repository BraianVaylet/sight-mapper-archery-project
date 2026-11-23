import type { SightScale } from '@sight-mapper/domain';
import type { Mark } from '@sight-mapper/schemas';
import type { GridResult } from '../distances/distances.logic.js';
import { readingOf } from '../sight/sight.logic.js';

export type PrintRow = {
  /** In the archer's unit: what the sheet shows. */
  readonly distance: number;
  /** Measured by the archer (printed plain) or calculated (printed with `≈`, never colour alone). */
  readonly measured: boolean;
  readonly reading: number;
  /** A calculated reading to confirm at the range: low confidence, or off the scale of the sight. */
  readonly caution: boolean;
  /** The windage of a measured mark, as a reading of the horizontal scale (F1-42). Never estimated. */
  readonly windage: number | null;
};

export type PrintSheet = {
  readonly rows: readonly PrintRow[];
  /** Distances in the range the marks do not allow to estimate: they are left out, and counted. */
  readonly omitted: number;
  readonly hasEstimates: boolean;
  readonly hasCautions: boolean;
  /** The windage column is printed only when some row has a windage to show. */
  readonly columns: { readonly windage: boolean };
};

/** The marks and the horizontal scale, for the windage column. */
export type PrintWindage = {
  readonly marks: readonly Mark[];
  readonly scale: SightScale | null;
};

/** Grid distances come back from the archer's unit: compare with a margin, not with `===`. */
const SAME_DISTANCE_M = 1e-6;

/**
 * The rows of the printable list (HU-CAL-05): the table of distances of the chosen step, with what
 * was calculated marked. A distance the marks cannot answer is not printed as a guess: it is left
 * out and the sheet says how many. The sheet reads in black and white, so every difference is a
 * sign (`≈`, `*`), not a colour.
 */
export function printSheet(grid: GridResult, windage?: PrintWindage): PrintSheet {
  const none = { windage: false };
  if (!grid.ok) {
    return { rows: [], omitted: 0, hasEstimates: false, hasCautions: false, columns: none };
  }
  const windageAt = (distanceM: number): number | null => {
    const scale = windage?.scale ?? null;
    if (scale === null) return null;
    const found = windage?.marks.find(
      (m) => Math.abs(m.distanceM - distanceM) < SAME_DISTANCE_M && m.windageMm !== null,
    );
    return found?.windageMm == null ? null : readingOf(found.windageMm, scale);
  };
  const rows = grid.rows.flatMap((row): PrintRow[] => {
    const r = row.reading;
    if (!r.ok) return [];
    return [
      {
        distance: row.distance,
        measured: r.kind === 'measured',
        reading: r.reading,
        caution: r.kind !== 'measured' && (r.lowConfidence || r.outOfScale),
        windage: r.kind === 'measured' ? windageAt(row.distanceM) : null,
      },
    ];
  });
  return {
    rows,
    omitted: grid.rows.length - rows.length,
    hasEstimates: rows.some((row) => !row.measured),
    hasCautions: rows.some((row) => row.caution),
    columns: { windage: rows.some((row) => row.windage !== null) },
  };
}
