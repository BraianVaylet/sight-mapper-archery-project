// Exact by definition (UNIDADES §2).
export const M_PER_YD = 0.9144;
export const MM_PER_IN = 25.4;
export const G_PER_GR = 0.06479891;
export const MPS_PER_FPS = 0.3048;
export const N_PER_LBF = 4.4482216152605;
export const N_PER_KGF = 9.80665;

/** Canonical distances are metres rounded to 0.001 (1 mm). */
export const DISTANCE_QUANTUM_M = 0.001;

/** Fixed scale size in mm for scales that are not user-defined (UNIDADES §3). */
export const FIXED_UNIT_SIZE_MM = { mm: 1, cm: 10, in: MM_PER_IN } as const;
