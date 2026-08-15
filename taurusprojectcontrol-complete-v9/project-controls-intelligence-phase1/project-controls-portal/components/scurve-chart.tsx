import type { CurvePoint } from "@/lib/types";

type SeriesKey = "baseline" | "planned" | "actual";

const series: Array<{ key: SeriesKey; label: string; color: string; dash?: string }> = [
  { key: "baseline", label: "Baseline", color: "#93a4bd", dash: "7 6" },
  { key: "planned", label: "Current Plan", color: "#f4b740" },
  { key: "actual", label: "Actual", color: "#35c68a" }
];

export function ScurveChart({ points, granularity = "monthly" }: { points: CurvePoint[]; granularity?: "year" | "monthly" | "weekly" }) {
  const width = 860;
  const height = 350;
  const left = 54;
  const right = 22;
  const top = 24;
  const bottom = 48;
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

  const labelIndexes = Array.from(
    new Set([0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1])
  ).filter((index) => index >= 0);

  return (
    <div className="chart-wrap" aria-label="Project S-curve">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
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
        {points.map((point, index) =>
          point.actual === null ? null : (
            <circle key={point.date} cx={x(index)} cy={y(point.actual)} r="3.6" fill="#35c68a" />
          )
        )}
        {labelIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 17}
            textAnchor="middle"
            className="chart-axis-label"
          >
            {granularity === "year"
              ? points[index]?.date.slice(0, 4)
              : new Date(`${points[index]?.date}T00:00:00Z`).toLocaleDateString("en-GB", {
                  day: granularity === "weekly" ? "2-digit" : undefined,
                  month: "short",
                  year: "2-digit",
                  timeZone: "UTC"
                })}
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
