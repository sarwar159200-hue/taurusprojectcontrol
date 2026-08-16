import type { CurvePoint } from "@/lib/types";
import { projectWeekNumber, type ProgressGrain } from "@/lib/progress-analytics";

type SeriesKey = "baseline" | "planned" | "actual";

const series: Array<{ key: SeriesKey; label: string; color: string; dash?: string }> = [
  { key: "baseline", label: "Baseline", color: "#93a4bd", dash: "7 6" },
  { key: "planned", label: "Current Plan", color: "#f4b740" },
  { key: "actual", label: "Actual", color: "#35c68a" }
];

export function ScurveChart({ points, granularity = "monthly" }: { points: CurvePoint[]; granularity?: ProgressGrain }) {
  // A fixed analytical canvas is scaled to the available panel width. This
  // keeps the complete programme visible and removes horizontal scrolling.
  const width = 1200;
  const height = granularity === "year" ? 360 : granularity === "weekly" ? 430 : 470;
  const left = 62;
  const right = 28;
  const top = 24;
  const bottom = granularity === "year" ? 58 : granularity === "weekly" ? 72 : 112;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const denominator = Math.max(points.length - 1, 1);
  const x = (index: number) => left + (index / denominator) * plotWidth;
  const y = (value: number) => top + (1 - Math.max(0, Math.min(1, value))) * plotHeight;

  function smoothSegment(values: Array<{ index: number; value: number }>) {
    if (!values.length) return "";
    if (values.length === 1) return `M${x(values[0].index).toFixed(1)},${y(values[0].value).toFixed(1)}`;
    const coordinates = values.map((item) => ({ x: x(item.index), y: y(item.value) }));
    const slopes = coordinates.slice(0, -1).map((point, index) =>
      (coordinates[index + 1].y - point.y) / (coordinates[index + 1].x - point.x)
    );
    const tangents = coordinates.map((_, index) => {
      if (index === 0) return slopes[0];
      if (index === coordinates.length - 1) return slopes.at(-1)!;
      const before = slopes[index - 1];
      const after = slopes[index];
      return before * after <= 0 ? 0 : (before + after) / 2;
    });

    // Fritsch–Carlson limiting preserves monotonic cumulative sections and
    // prevents a smooth curve from overshooting the workbook values.
    slopes.forEach((slope, index) => {
      if (Math.abs(slope) < 1e-12) {
        tangents[index] = 0;
        tangents[index + 1] = 0;
        return;
      }
      const a = tangents[index] / slope;
      const b = tangents[index + 1] / slope;
      const magnitude = Math.hypot(a, b);
      if (magnitude > 3) {
        const scale = 3 / magnitude;
        tangents[index] = scale * a * slope;
        tangents[index + 1] = scale * b * slope;
      }
    });

    let path = `M${coordinates[0].x.toFixed(1)},${coordinates[0].y.toFixed(1)}`;
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const from = coordinates[index];
      const to = coordinates[index + 1];
      const distance = to.x - from.x;
      path += ` C${(from.x + distance / 3).toFixed(1)},${(from.y + tangents[index] * distance / 3).toFixed(1)}`;
      path += ` ${(to.x - distance / 3).toFixed(1)},${(to.y - tangents[index + 1] * distance / 3).toFixed(1)}`;
      path += ` ${to.x.toFixed(1)},${to.y.toFixed(1)}`;
    }
    return path;
  }

  const pathFor = (key: SeriesKey) => {
    const segments: Array<Array<{ index: number; value: number }>> = [];
    let segment: Array<{ index: number; value: number }> = [];
    points.forEach((point, index) => {
      const value = point[key];
      if (value === null) {
        if (segment.length) segments.push(segment);
        segment = [];
        return;
      }
      segment.push({ index, value });
    });
    if (segment.length) segments.push(segment);
    return segments.map(smoothSegment).join(" ");
  };

  const labelIndexes = points.map((_, index) => index);
  const hitWidth = Math.max(8, plotWidth / Math.max(points.length, 1));

  return (
    <div className="chart-wrap" aria-label="Project S-curve">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img">
        <defs>
          <linearGradient id="actual-progress-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#35c68a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#35c68a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              className="chart-grid"
            />
            <text x={left - 10} y={y(tick) + 4} textAnchor="end" className="chart-axis-label">
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}
        {series.map(({ key, color, dash }) => (
          <path
            key={key}
            d={pathFor(key)}
            fill="none"
            stroke={color}
            strokeWidth={key === "actual" ? 4 : 3}
            strokeDasharray={dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {points.map((point, index) => {
          const values = [
            point.baseline === null ? null : `Baseline ${(point.baseline * 100).toFixed(2)}%`,
            point.planned === null ? null : `Plan ${(point.planned * 100).toFixed(2)}%`,
            point.actual === null ? null : `Actual ${(point.actual * 100).toFixed(2)}%`
          ].filter(Boolean).join(" · ");
          return (
            <g key={point.date}>
              {point.actual === null ? null : <circle cx={x(index)} cy={y(point.actual)} r="3.6" fill="#35c68a" />}
              <rect x={x(index) - hitWidth / 2} y={top} width={hitWidth} height={plotHeight} fill="transparent">
                <title>{`${point.date}${values ? ` · ${values}` : " · No workbook values"}`}</title>
              </rect>
            </g>
          );
        })}
        {labelIndexes.map((index) => granularity === "monthly" ? (
          <text key={index} transform={`translate(${x(index).toFixed(1)} ${height - bottom + 18}) rotate(-58)`} textAnchor="end" className="chart-axis-label chart-month-label">
            {new Date(`${points[index].date}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}
          </text>
        ) : (
          <text key={index} x={x(index)} y={height - 25} textAnchor="middle" className={`chart-axis-label ${granularity === "weekly" ? "chart-week-label" : ""}`}>
            {granularity === "weekly" ? `W${projectWeekNumber(points[index].date)}` : points[index]?.date.slice(0, 4)}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} /> {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
