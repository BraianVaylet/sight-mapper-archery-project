export const CALC_MIN_MARKS_INTERPOLATE = 2;
export const CALC_MIN_MARKS_EXTRAPOLATE = 3;
export const CALC_MIN_MARKS_DOCTOR = 5;
/** Beyond this fraction of the measured range an extrapolation is flagged low confidence. */
export const EXTRAPOLATION_WARN_RATIO = 0.25;
/**
 * Measurement tolerance of the Doctor: a leave-one-out residual under this many mm (or under one
 * quantum, whichever is larger) is not an error. Calibrated on two real sets (SIGHT-MATH §8.3).
 */
export const DOCTOR_MIN_ABS_MM = 4;
/** Endpoints are predicted by extrapolation, so they get more tolerance. */
export const DOCTOR_ENDPOINT_FACTOR = 2.5;
export const MAX_DISTANCE_M = 300;

/** A grid row within 1 mm of a measured mark is that mark (SIGHT-MATH §9). */
export const MEASURED_SNAP_M = 0.001;
/** Upper bound on grid rows, so a bad step cannot allocate unbounded memory. */
export const MAX_GRID_ROWS = 10_000;

/** Below this spacing a tick level is not drawn: an unreadable ruler is worse (SIGHT-MATH §10). */
export const RULER_MIN_TICK_GAP_PX = 4;
/** Upper bound on ticks per ruler, so a huge span cannot allocate unbounded memory. */
export const MAX_RULER_TICKS = 10_000;
