import type { CurvePoint } from "@/lib/types";
import { projectWeekNumber, type ProgressGrain } from "@/lib/progress-analytics";

type SeriesKey = "baseline" | "planned" | "actual";

const series: Array<{ key: SeriesKey; label: string; color: string; dash?: string }> = [
  { key: "baseline", label: "Baseline", color: "#93a4bd", dash: "7 6" },
  { key: "planned", label: "Current Plan", color: "#f4b740" },
  { key: "actual", label: "Actual", color: "#35c68a" }
];

export function ScurveChart({ points, granularity = "monthly" }: { points: CurvePoint[]; granularity?: ProgressGrain }) {
  const pointSpacing = granularity === "year" ? 170 : granularity === "weekly" ? 78 : 88;
  const width = Math.max(860, 76 + Math.max(points.length - 1, 1) * pointSpacing + 42);
  const height = granularity === "year" ? 370 : 410;
  const left = 54;
  const right = 22;
  const top = 24;
  const bottom = granularity === "year" ? 58 : 94;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const denominator = Math.max(points.length - 1, 1);
  const x = (index: number) => left + (index / denominator) * plotWidth;
  const y = (value: number) => top + (1 - Math.max(0, Math.min(1, value))) * plotHeight;

  const pathFor = (key: SeriesKey) => {
    let path = "";
    let penDown = false;
    points.forEach((point, index) => {
      const value = point[key];
      if (value === null) {
        penDown = false;
        return;
      }
      path += `${penDown ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)} `;
      penDown = true;
    });
    return path.trim();
  };

  const labelIndexes = points.map((_, index) => index);

  return (
    <div className="chart-wrap" aria-label="Project S-curve">
      <div className="chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" style={{ minWidth: `${width}px` }}>
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
              <rect x={x(index) - pointSpacing / 2} y={top} width={pointSpacing} height={plotHeight} fill="transparent">
                <title>{`${point.date}${values ? ` · ${values}` : " · No workbook values"}`}</title>
              </rect>
            </g>
          );
        })}
        {labelIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - (granularity === "year" ? 22 : 50)}
            textAnchor="middle"
            className="chart-axis-label"
          >
            {granularity === "weekly" ? (
              <>
                <tspan x={x(index)} dy="0" className="chart-week-label">W{projectWeekNumber(points[index].date)}</tspan>
                <tspan x={x(index)} dy="16">{new Date(`${points[index].date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })}</tspan>
              </>
            ) : granularity === "year" ? points[index]?.date.slice(0, 4) : (
              <>
                <tspan x={x(index)} dy="0">{new Date(`${points[index].date}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</tspan>
                <tspan x={x(index)} dy="16">{points[index]?.date.slice(0, 4)}</tspan>
              </>
            )}
          </text>
        ))}
      </svg>
      </div>
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
