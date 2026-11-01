import {
  buildRuler,
  placeMarks,
  positionOf,
  type RulerScale,
  type TickLevel,
} from '@sight-mapper/domain';

export type RulerMark = {
  readonly id: string;
  /** In scale units: what the archer reads on the sight. */
  readonly reading: number;
  /** A measured mark is a filled dot on a solid line; an estimate is a diamond on a dotted one. */
  readonly measured: boolean;
  /** Already formatted, e.g. `20 m` or `≈ 25 m`. */
  readonly label: string;
};

export type RulerProps = {
  scale: RulerScale;
  marks: readonly RulerMark[];
  /** Accessible name; the numbers themselves are in the table next to it. */
  label: string;
  /** Formats a tick value in the archer's unit and decimal separator. */
  formatValue: (value: number) => string;
  lengthPx?: number;
};

const PAD = 14;
const AXIS_X = 150;
const WIDTH = 270;
const LABEL_HEIGHT_PX = 16;
const TICK_LENGTH: Record<TickLevel, number> = { minor: 8, medium: 14, major: 22 };

/**
 * The sight scale drawn to size (SIGHT-MATH §10): the ticks and the position of every mark come
 * from the domain, so what is drawn is what the archer would read. Measured and estimated differ
 * by shape and line style, never by colour alone (UX-UI §1.3).
 */
export function Ruler({ scale, marks, label, formatValue, lengthPx = 480 }: RulerProps) {
  const ticks = buildRuler({ scale, lengthPx });
  const placed = placeMarks(
    scale,
    lengthPx,
    marks.map(({ id, reading }) => ({ id, reading })),
    LABEL_HEIGHT_PX,
  );
  const byId = new Map(marks.map((mark) => [mark.id, mark]));

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${lengthPx + PAD * 2}`}
      width={WIDTH}
      height={lengthPx + PAD * 2}
      className="max-w-full text-text"
    >
      <g transform={`translate(0 ${PAD})`}>
        <line
          x1={AXIS_X}
          x2={AXIS_X}
          y1={0}
          y2={lengthPx}
          className="stroke-text"
          strokeWidth={2}
        />
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={AXIS_X}
              x2={AXIS_X + TICK_LENGTH[tick.level]}
              y1={tick.positionPx}
              y2={tick.positionPx}
              className="stroke-muted"
              strokeWidth={tick.level === 'major' ? 1.5 : 1}
            />
            {tick.labelled ? (
              <text
                x={AXIS_X + TICK_LENGTH.major + 6}
                y={tick.positionPx}
                dominantBaseline="middle"
                className="fill-muted font-ui text-[11px]"
              >
                {formatValue(tick.value)}
              </text>
            ) : null}
          </g>
        ))}

        {placed.map((spot) => {
          const mark = byId.get(spot.id);
          if (mark === undefined) return null;
          const y = positionOf(mark.reading, scale, lengthPx);
          return (
            <g key={spot.id} data-mark={mark.measured ? 'measured' : 'estimated'}>
              <line
                x1={AXIS_X - 52}
                x2={AXIS_X}
                y1={y}
                y2={y}
                className={mark.measured ? 'stroke-accent' : 'stroke-info'}
                strokeWidth={2}
                strokeDasharray={mark.measured ? undefined : '3 3'}
              />
              {mark.measured ? (
                <circle cx={AXIS_X - 52} cy={y} r={5} className="fill-accent" />
              ) : (
                <path
                  d={`M${AXIS_X - 52} ${y - 6}l6 6-6 6-6-6z`}
                  className="fill-bg stroke-info"
                  strokeWidth={1.5}
                />
              )}
              {/* A leader joins the label to its real position when neighbours pushed it away. */}
              {Math.abs(spot.labelPositionPx - y) > 1 ? (
                <line
                  x1={AXIS_X - 58}
                  x2={AXIS_X - 64}
                  y1={y}
                  y2={spot.labelPositionPx}
                  className="stroke-muted"
                  strokeWidth={1}
                />
              ) : null}
              <text
                x={AXIS_X - 68}
                y={spot.labelPositionPx}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text font-ui text-xs"
              >
                {mark.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
