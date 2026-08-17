"use client";

import { useLanguage } from "@/components/language-provider";
import { controlledCumulativeCurve } from "@/lib/progress-metrics";
import type { CurvePoint } from "@/lib/types";

type SeriesKey = "baseline" | "actual";
type PlotPoint = { x: number; y: number };

const series: Array<{ key: SeriesKey; label: string; color: string; dash?: string }> = [
  { key: "baseline", label: "Approved baseline", color: "#2f63b7", dash: "10 7" },
  { key: "actual", label: "Actual cumulative", color: "#16a879" }
];

function monotonePath(values: PlotPoint[]) {
  if (!values.length) return "";
  if (values.length === 1) return `M${values[0].x.toFixed(1)},${values[0].y.toFixed(1)}`;

  const slopes = values.slice(0, -1).map((point, index) => {
    const next = values[index + 1];
    return (next.y - point.y) / Math.max(next.x - point.x, 0.0001);
  });
  const tangents = values.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === values.length - 1) return slopes.at(-1)!;
    if (slopes[index - 1] * slopes[index] <= 0) return 0;
    return (slopes[index - 1] + slopes[index]) / 2;
  });

  slopes.forEach((slope, index) => {
    if (Math.abs(slope) < 0.0000001) {
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

  let path = `M${values[0].x.toFixed(1)},${values[0].y.toFixed(1)}`;
  for (let index = 0; index < values.length - 1; index += 1) {
    const point = values[index];
    const next = values[index + 1];
    const width = next.x - point.x;
    path += ` C${(point.x + width / 3).toFixed(1)},${(point.y + tangents[index] * width / 3).toFixed(1)}`;
    path += ` ${(next.x - width / 3).toFixed(1)},${(next.y - tangents[index + 1] * width / 3).toFixed(1)}`;
    path += ` ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }
  return path;
}

function projectReportingWeek(dateString: string) {
  // Controlled workbook mapping: 05-Feb-2026 is project reporting week 32.
  const referenceDate = Date.parse("2026-02-05T00:00:00Z");
  const reportingDate = Date.parse(`${dateString}T00:00:00Z`);
  const weekOffset = Math.round((reportingDate - referenceDate) / (7 * 86_400_000));
  return 32 + weekOffset;
}

export function ScurveChart({ points, granularity = "monthly" }: { points: CurvePoint[]; granularity?: "year" | "monthly" | "weekly" }) {
  const { locale, t } = useLanguage();
  const prepared = controlledCumulativeCurve(points);
  // A fixed responsive viewBox keeps the complete approved baseline visible
  // from the first to the final reporting period without horizontal scrolling.
  const width = granularity === "weekly" ? 1320 : 1200;
  const height = granularity === "weekly" ? 500 : 438;
  const left = 62;
  const right = 30;
  const top = 30;
  const bottom = granularity === "weekly" ? 110 : 82;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const times = prepared.map((point) => Date.parse(`${point.date}T00:00:00Z`));
  const minimumTime = Math.min(...times);
  const maximumTime = Math.max(...times);
  const timeSpan = Math.max(maximumTime - minimumTime, 1);
  const x = (index: number) => left + ((times[index] - minimumTime) / timeSpan) * plotWidth;
  const y = (value: number) => top + (1 - Math.max(0, Math.min(1, value))) * plotHeight;
  const valuesFor = (key: SeriesKey) => prepared.flatMap((point, index) => {
    const value = point[key];
    return value === null ? [] : [{ x: x(index), y: y(value) }];
  });
  const actualValues = valuesFor("actual");
  const actualArea = actualValues.length > 1
    ? `${monotonePath(actualValues)} L${actualValues.at(-1)!.x.toFixed(1)},${y(0).toFixed(1)} L${actualValues[0].x.toFixed(1)},${y(0).toFixed(1)} Z`
    : "";
  const latestActualIndex = prepared.reduce((latest, point, index) => point.actual === null ? latest : index, -1);
  const dateLocale = locale === "ar" ? "ar-IQ" : locale === "ku" ? "ckb-IQ" : "en-GB";

  return (
    <div className="chart-wrap professional-scurve" aria-label={t("Project S-curve")}>
      <div className="chart-fit-shell">
      <svg className="responsive-scurve-svg" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="actualArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16a879" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#16a879" stopOpacity="0.01" />
          </linearGradient>
          <filter id="curveGlow" height="140%" width="140%" x="-20%" y="-20%">
            <feGaussianBlur result="blur" stdDeviation="2.2" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect className="chart-plot-bg" x={left} y={top} width={plotWidth} height={plotHeight} rx="10" />
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={left - 12} y={y(tick) + 4} textAnchor="end" className="chart-axis-label">{Math.round(tick * 100)}%</text>
          </g>
        ))}
        {actualArea ? <path d={actualArea} fill="url(#actualArea)" /> : null}
        {series.map(({ key, color, dash }) => (
          <path
            key={key}
            d={monotonePath(valuesFor(key))}
            fill="none"
            stroke={color}
            strokeWidth={key === "actual" ? 4.8 : 3.2}
            strokeDasharray={dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={key === "actual" ? "url(#curveGlow)" : undefined}
          />
        ))}
        {prepared.map((point, index) => point.actual === null ? null : (
          <circle key={point.date} cx={x(index)} cy={y(point.actual)} r={index === latestActualIndex ? 5.4 : 2.8} className="actual-point" />
        ))}
        {latestActualIndex >= 0 ? (
          <g>
            <line className="data-date-marker" x1={x(latestActualIndex)} x2={x(latestActualIndex)} y1={top} y2={top + plotHeight} />
            <text className="data-date-label" x={Math.min(x(latestActualIndex) + 8, width - 118)} y={top + 17}>{t("Data date")}</text>
          </g>
        ) : null}
        {prepared.map((point, index) => {
          const dateLabel = new Date(`${point.date}T00:00:00Z`).toLocaleDateString(dateLocale, {
            day: granularity === "weekly" ? "2-digit" : undefined,
            month: "short",
            year: "2-digit",
            timeZone: "UTC"
          });
          const label = granularity === "weekly"
            ? `W${String(projectReportingWeek(point.date)).padStart(2, "0")} · ${dateLabel}`
            : dateLabel;
          return (
            <text
              key={`${point.date}-${index}`}
              x={x(index)}
              y={height - (granularity === "weekly" ? 52 : 30)}
              textAnchor={granularity === "weekly" ? "end" : "middle"}
              transform={granularity === "weekly" ? `rotate(-55 ${x(index)} ${height - 52})` : undefined}
              className="chart-axis-label chart-period-label"
            >
              {label}
            </text>
          );
        })}
      </svg>
      </div>
      <div className="chart-legend">
        {series.map((item) => <span key={item.key}><i className={`legend-line legend-${item.key}`} /> {t(item.label)}</span>)}
        <span className="chart-method-badge">{t("Cumulative · baseline controlled")}</span>
      </div>
    </div>
  );
}
