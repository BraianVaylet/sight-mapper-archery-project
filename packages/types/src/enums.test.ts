import { describe, expect, it } from 'vitest';
import {
  BOW_TYPES,
  CAM_TYPES,
  COMPONENT_STATUSES,
  COMPUTED_KINDS,
  DOCTOR_STATUSES,
  LOCALES,
  MARK_ORIGINS,
  PIN_TYPES,
  SCALE_CHANGE_STRATEGIES,
  SCALE_DIRECTIONS,
  SCALE_UNITS,
  THEMES,
  UNIT_SYSTEMS,
} from './enums.js';

// DICCIONARIO §5. A change here is a change to the data dictionary.
describe('enums match the data dictionary', () => {
  it.each([
    ['BowType', BOW_TYPES, ['compound', 'recurve', 'crossbow']],
    ['CamType', CAM_TYPES, ['single', 'hybrid', 'binary']],
    ['PinType', PIN_TYPES, ['monopin', 'dualpin', 'multipin']],
    ['ScaleUnit', SCALE_UNITS, ['mm', 'cm', 'in', 'click', 'custom']],
    ['ScaleDirection', SCALE_DIRECTIONS, ['down', 'up']],
    ['ComponentStatus', COMPONENT_STATUSES, ['active', 'archived']],
    ['MarkOrigin', MARK_ORIGINS, ['measured', 'seeded']],
    ['ComputedKind', COMPUTED_KINDS, ['measured', 'interpolated', 'extrapolated']],
    ['DoctorStatus', DOCTOR_STATUSES, ['insufficient', 'ok', 'suspect', 'inconsistent']],
    ['Locale', LOCALES, ['es', 'en']],
    ['UnitSystem', UNIT_SYSTEMS, ['metric', 'imperial']],
    ['Theme', THEMES, ['dark', 'light', 'system']],
    ['ScaleChangeStrategy', SCALE_CHANGE_STRATEGIES, ['keepReadings', 'keepPositions']],
  ] as const)('%s', (_name, actual, expected) => {
    expect([...actual]).toEqual([...expected]);
  });
});
