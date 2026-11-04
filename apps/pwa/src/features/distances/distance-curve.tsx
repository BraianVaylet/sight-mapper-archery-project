import type { CurveGeometry, CurvePoint } from './distances.logic.js';

export type DistanceCurveProps = {
  geometry: CurveGeometry;
  width: number;
  height: number;
  /** Accessible name; the table next to it carries every number (UX-UI §5). */
  label: string;
  xTitle: string;
  yTitle: string;
  formatX: (distance: number) => string;
  formatY: (reading: number) => string;
  /** The point that is picked, by distance in the archer's unit: it gets a ring and guides. */
  selectedDistance?: number | undefined;
  onSelect?: ((distance: number) => void) | undefined;
};

/** A diamond centred on a point: the shape of what was calculated, not measured. */
const diamond = (p: CurvePoint, r: number) => `M${p.x} ${p.y - r}l${r} ${r}-${r} ${r}-${r}-${r}z`;

/**
 * Distance against what the archer reads on the sight (HU-CAL-02). Measured points are filled dots
 * joined by a solid line; anything calculated is a diamond on a dashed one, so the difference
 * never rests on colour alone (UX-UI §1.3). Every coordinate comes from `curveGeometry`.
 */
export function DistanceCurve({
  geometry,
  width,
  height,
  label,
  xTitle,
  yTitle,
  formatX,
  formatY,
  selectedDistance,
  onSelect,
}: DistanceCurveProps) {
  const { plot, points, segments, xTicks, yTicks, query } = geometry;
  const picked =
    selectedDistance === undefined
      ? undefined
      : (points.find((p) => p.distance === selectedDistance) ??
        (query?.distance === selectedDistance ? query : undefined));

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="max-w-full text-text"
    >
      <rect
        x={plot.left}
        y={plot.top}
        width={plot.right - plot.left}
        height={plot.bottom - plot.top}
        className="fill-none stroke-border"
      />
      {yTicks.map((tick) => (
        <g key={`y${tick.value}`}>
          <line
            x1={plot.left}
            x2={plot.right}
            y1={tick.at}
            y2={tick.at}
            className="stroke-border"
            strokeWidth={1}
            opacity={0.5}
          />
          <text
            x={plot.left - 6}
            y={tick.at}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted font-ui text-[11px]"
          >
            {formatY(tick.value)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`x${tick.value}`}>
          <line
            x1={tick.at}
            x2={tick.at}
            y1={plot.top}
            y2={plot.bottom}
            className="stroke-border"
            strokeWidth={1}
            opacity={0.5}
          />
          <text
            x={tick.at}
            y={plot.bottom + 14}
            textAnchor="middle"
            className="fill-muted font-ui text-[11px]"
          >
            {formatX(tick.value)}
          </text>
        </g>
      ))}

      {picked === undefined ? null : (
        <g className="stroke-mark" strokeWidth={1} strokeDasharray="3 3">
          <line x1={plot.left} x2={picked.x} y1={picked.y} y2={picked.y} />
          <line x1={picked.x} x2={picked.x} y1={picked.y} y2={plot.bottom} />
        </g>
      )}

      {segments.map((segment) => (
        <line
          key={`${segment.from.key}-${segment.to.key}`}
          data-line={segment.solid ? 'solid' : 'dashed'}
          x1={segment.from.x}
          y1={segment.from.y}
          x2={segment.to.x}
          y2={segment.to.y}
          className={segment.solid ? 'stroke-mark' : 'stroke-info'}
          strokeWidth={2}
          strokeDasharray={segment.solid ? undefined : '4 4'}
        />
      ))}

      {points.map((p) => (
        <g
          key={p.key}
          data-point={p.measured ? 'measured' : 'estimated'}
          onClick={onSelect === undefined ? undefined : () => onSelect(p.distance)}
          className={onSelect === undefined ? undefined : 'cursor-pointer'}
        >
          {/* A thumb-sized target around a point of a few pixels; invisible. */}
          <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
          {p.measured ? (
            <circle cx={p.x} cy={p.y} r={4.5} className="fill-mark" />
          ) : (
            <path d={diamond(p, 6)} className="fill-bg stroke-info" strokeWidth={1.5} />
          )}
        </g>
      ))}

      {query === undefined ? null : (
        <path
          data-point="query"
          d={diamond(query, 7)}
          className="fill-bg stroke-text"
          strokeWidth={2}
        />
      )}
      {picked === undefined ? null : (
        <circle
          cx={picked.x}
          cy={picked.y}
          r={11}
          className="fill-none stroke-mark"
          strokeWidth={2}
        />
      )}

      <text
        x={(plot.left + plot.right) / 2}
        y={height - 4}
        textAnchor="middle"
        className="fill-muted font-ui text-xs"
      >
        {xTitle}
      </text>
      <text
        transform={`translate(12 ${(plot.top + plot.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
        className="fill-muted font-ui text-xs"
      >
        {yTitle}
      </text>
    </svg>
  );
}
