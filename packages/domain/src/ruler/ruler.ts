import { MAX_RULER_TICKS, RULER_MIN_TICK_GAP_PX } from '../constants.js';
import { DomainError } from '../errors.js';
import type { SightScale } from '../convert/scale.js';

export type RulerScale = Pick<SightScale, 'unit' | 'min' | 'max' | 'direction'>;

export type TickLevel = 'minor' | 'medium' | 'major';

export type RulerTick = {
  /** In scale units (what the archer reads). */
  readonly value: number;
  readonly level: TickLevel;
  /** Distance from the top of the ruler, in px. */
  readonly positionPx: number;
  readonly labelled: boolean;
};

export type RulerRequest = {
  readonly scale: RulerScale;
  readonly lengthPx: number;
  readonly minTickGapPx?: number;
};

export type RulerMarkInput = { readonly id: string; readonly reading: number };

export type PlacedMark = {
  readonly id: string;
  /** Where the mark really is: the guide line is drawn here. */
  readonly positionPx: number;
  /** Where its label goes, pushed apart from neighbours. */
  readonly labelPositionPx: number;
};

/**
 * Ticks are whole numbers of the minor tick: `ticksPerUnit` of them per scale unit, a medium
 * tick every `mediumEvery` and a major one every `majorEvery` (SIGHT-MATH §10). Working on the
 * integer index avoids the drift of adding 0.1 repeatedly.
 */
const TICKS: Record<
  SightScale['unit'],
  { ticksPerUnit: number; mediumEvery: number; majorEvery: number }
> = {
  mm: { ticksPerUnit: 1, mediumEvery: 5, majorEvery: 10 },
  cm: { ticksPerUnit: 10, mediumEvery: 5, majorEvery: 10 },
  in: { ticksPerUnit: 16, mediumEvery: 4, majorEvery: 16 },
  click: { ticksPerUnit: 1, mediumEvery: 5, majorEvery: 10 },
  custom: { ticksPerUnit: 10, mediumEvery: 5, majorEvery: 10 },
};

/** Tolerance for `min` landing a hair off a tick because of how it was typed. */
const TICK_EPSILON = 1e-9;

export function buildRuler(request: RulerRequest): RulerTick[] {
  const { scale, lengthPx, minTickGapPx = RULER_MIN_TICK_GAP_PX } = request;
  assertGeometry(scale, lengthPx);
  if (!Number.isFinite(minTickGapPx) || minTickGapPx <= 0) {
    throw new DomainError('Minimum tick gap must be greater than zero');
  }

  const { ticksPerUnit, mediumEvery, majorEvery } = TICKS[scale.unit];
  const minT = scale.min * ticksPerUnit;
  const spanT = (scale.max - scale.min) * ticksPerUnit;
  if (!Number.isFinite(minT) || !Number.isFinite(spanT)) {
    throw new DomainError('Scale span is too large to draw');
  }
  const pxPerTick = lengthPx / spanT;

  const showMinor = pxPerTick >= minTickGapPx;
  const showMedium = pxPerTick * mediumEvery >= minTickGapPx;
  const showMajor = pxPerTick * majorEvery >= minTickGapPx;
  if (!showMajor) return [];

  // Step over the finest level that is drawn, so the loop tracks drawn ticks, not the span.
  // Medium and major indices are multiples of the medium step, so aligning `first` keeps them.
  const step = showMinor ? 1 : showMedium ? mediumEvery : majorEvery;
  const last = Math.floor(minT + spanT + TICK_EPSILON);
  // `|| 0` turns the -0 of Math.ceil into 0, so no tick is ever labelled "-0".
  const first = Math.ceil(Math.ceil(minT - TICK_EPSILON) / step) * step || 0;
  if ((last - first) / step + 1 > MAX_RULER_TICKS) {
    throw new DomainError('Ruler has too many ticks');
  }
  const ticks: RulerTick[] = [];

  for (let i = first; i <= last; i += step) {
    const level = levelOf(i, mediumEvery, majorEvery);
    if (level === 'medium' && !showMedium) continue;

    const offset = scale.direction === 'down' ? i - minT : minT + spanT - i;
    ticks.push({
      value: i / ticksPerUnit,
      level,
      positionPx: (lengthPx * offset) / spanT,
      labelled: level === 'major',
    });
  }

  return scale.direction === 'down' ? ticks : ticks.reverse();
}

/** Pixel position of a reading, not clipped: the caller decides what to do off-scale. */
export function positionOf(reading: number, scale: RulerScale, lengthPx: number): number {
  assertGeometry(scale, lengthPx);
  if (!Number.isFinite(reading)) throw new DomainError('Reading must be a finite number');
  const offset = scale.direction === 'down' ? reading - scale.min : scale.max - reading;
  return (lengthPx * offset) / (scale.max - scale.min);
}

/**
 * Places the labels of marked readings so they do not overlap: the label moves, the data does
 * not (`positionPx` stays the real one for the guide line). Labels are pushed down, and if the
 * cluster runs past the bottom it is pulled back up.
 */
export function placeMarks(
  scale: RulerScale,
  lengthPx: number,
  marks: readonly RulerMarkInput[],
  labelHeightPx: number,
): PlacedMark[] {
  if (!Number.isFinite(labelHeightPx) || labelHeightPx <= 0) {
    throw new DomainError('Label height must be greater than zero');
  }

  const sorted = marks
    .map((mark) => ({ id: mark.id, positionPx: positionOf(mark.reading, scale, lengthPx) }))
    .sort((a, b) => a.positionPx - b.positionPx);

  const labels = sorted.map((m) => m.positionPx);
  for (let i = 1; i < labels.length; i++) {
    labels[i] = Math.max(labels[i] as number, (labels[i - 1] as number) + labelHeightPx);
  }
  if (labels.length > 0 && (labels[labels.length - 1] as number) > lengthPx) {
    labels[labels.length - 1] = lengthPx;
    for (let i = labels.length - 2; i >= 0; i--) {
      labels[i] = Math.min(labels[i] as number, (labels[i + 1] as number) - labelHeightPx);
    }
  }

  return sorted.map((m, i) => ({ ...m, labelPositionPx: labels[i] as number }));
}

function levelOf(index: number, mediumEvery: number, majorEvery: number): TickLevel {
  if (mod(index, majorEvery) === 0) return 'major';
  if (mod(index, mediumEvery) === 0) return 'medium';
  return 'minor';
}

/** Modulo that stays non-negative, so negative scale values keep their levels. */
function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function assertGeometry(scale: RulerScale, lengthPx: number): void {
  if (!Number.isFinite(lengthPx) || lengthPx <= 0) {
    throw new DomainError('Ruler length must be greater than zero');
  }
  if (!Number.isFinite(scale.min) || !Number.isFinite(scale.max) || scale.max <= scale.min) {
    throw new DomainError('Scale needs finite bounds with min < max');
  }
}
