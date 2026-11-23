import type { GridResult } from '../distances/distances.logic.js';

export type PrintRow = {
  /** In the archer's unit: what the sheet shows. */
  readonly distance: number;
  /** Measured by the archer (printed plain) or calculated (printed with `≈`, never colour alone). */
  readonly measured: boolean;
  readonly reading: number;
  /** A calculated reading to confirm at the range: low confidence, or off the scale of the sight. */
  readonly caution: boolean;
};

export type PrintSheet = {
  readonly rows: readonly PrintRow[];
  /** Distances in the range the marks do not allow to estimate: they are left out, and counted. */
  readonly omitted: number;
  readonly hasEstimates: boolean;
  readonly hasCautions: boolean;
};

/**
 * The rows of the printable list (HU-CAL-05): the table of distances of the chosen step, with what
 * was calculated marked. A distance the marks cannot answer is not printed as a guess: it is left
 * out and the sheet says how many. The sheet reads in black and white, so every difference is a
 * sign (`≈`, `*`), not a colour.
 */
export function printSheet(grid: GridResult): PrintSheet {
  if (!grid.ok) return { rows: [], omitted: 0, hasEstimates: false, hasCautions: false };
  const rows = grid.rows.flatMap((row): PrintRow[] => {
    const r = row.reading;
    if (!r.ok) return [];
    return [
      {
        distance: row.distance,
        measured: r.kind === 'measured',
        reading: r.reading,
        caution: r.kind !== 'measured' && (r.lowConfidence || r.outOfScale),
      },
    ];
  });
  return {
    rows,
    omitted: grid.rows.length - rows.length,
    hasEstimates: rows.some((row) => !row.measured),
    hasCautions: rows.some((row) => row.caution),
  };
}
