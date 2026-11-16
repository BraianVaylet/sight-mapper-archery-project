// Enumerations of the data dictionary (docs/DICCIONARIO.md §5). Each is a readonly tuple so
// schemas, selects and exhaustive checks share one source of truth.

export const BOW_TYPES = ['compound', 'recurve', 'crossbow'] as const;
export type BowType = (typeof BOW_TYPES)[number];

export const CAM_TYPES = ['single', 'hybrid', 'binary'] as const;
export type CamType = (typeof CAM_TYPES)[number];

export const PIN_TYPES = ['monopin', 'dualpin', 'multipin'] as const;
export type PinType = (typeof PIN_TYPES)[number];

export const SCALE_UNITS = ['mm', 'cm', 'in', 'click', 'custom'] as const;
export type ScaleUnit = (typeof SCALE_UNITS)[number];

export const SCALE_DIRECTIONS = ['down', 'up'] as const;
export type ScaleDirection = (typeof SCALE_DIRECTIONS)[number];

export const COMPONENT_STATUSES = ['active', 'archived'] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

export const MARK_ORIGINS = ['measured', 'seeded'] as const;
export type MarkOrigin = (typeof MARK_ORIGINS)[number];

/** Computed by the domain, never persisted. */
export const COMPUTED_KINDS = ['measured', 'interpolated', 'extrapolated'] as const;
export type ComputedKind = (typeof COMPUTED_KINDS)[number];

/** Computed by the domain, never persisted. */
export const DOCTOR_STATUSES = ['insufficient', 'ok', 'suspect', 'inconsistent'] as const;
export type DoctorStatus = (typeof DOCTOR_STATUSES)[number];

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const THEMES = ['dark', 'light', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const SCALE_CHANGE_STRATEGIES = ['keepReadings', 'keepPositions'] as const;
export type ScaleChangeStrategy = (typeof SCALE_CHANGE_STRATEGIES)[number];
