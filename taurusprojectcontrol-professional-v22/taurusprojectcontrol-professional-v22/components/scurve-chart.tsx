"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { controlledCumulativeCurve } from "@/lib/progress-metrics";
import type { CurvePoint } from "@/lib/types";

type SeriesKey = "baseline" | "actual";
type PlotPoint = { x: number; y: number };

const series: Array<{ key: SeriesKey; label: string; color: string; dash?: string }> = [
  { key: "baseline", label: "Approved baseline", color: "#4f8cff", dash: "10 7" },
  { key: "actual", label: "Actual cumulative", color: "#20d19b" }
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
  const referenceDate = Date.parse("2026-02-05T00:00:00Z");
  const reportingDate = Date.parse(`${dateString}T00:00:00Z`);
  const weekOffset = Math.round((reportingDate - referenceDate) / (7 * 86_400_000));
  return 32 + weekOffset;
}

export function ScurveChart({ points, granularity = "monthly" }: { points: CurvePoint[]; granularity?: "year" | "monthly" | "weekly" }) {
  const { locale, t } = useLanguage();
  const prepared = controlledCumulativeCurve(points);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = granularity === "weekly" ? 1320 : 1200;
  const height = granularity === "weekly" ? 510 : 448;
  const left = 66;
  const right = 34;
  const top = 34;
  const bottom = granularity === "weekly" ? 112 : 86;
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
  const labelEvery = useMemo(() => {
    const targetLabels = granularity === "weekly" ? 14 : 18;
    return Math.max(1, Math.ceil(prepared.length / targetLabels));
  }, [prepared.length, granularity]);
  const hover = hoveredIndex === null ? null : prepared[hoveredIndex];

  return (
    <div className="chart-wrap professional-scurve executive-interactive-scurve" aria-label={t("Project S-curve")}>
      <div className="chart-fit-shell">
        <svg className="responsive-scurve-svg" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height}`} role="img" onMouseLeave={() => setHoveredIndex(null)}>
          <defs>
            <linearGradient id="actualArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#20d19b" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#20d19b" stopOpacity="0.015" />
            </linearGradient>
            <filter id="curveGlow" height="160%" width="160%" x="-30%" y="-30%">
              <feGaussianBlur result="blur" stdDeviation="2" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect className="chart-plot-bg" x={left} y={top} width={plotWidth} height={plotHeight} rx="12" />
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
              <text x={left - 14} y={y(tick) + 4} textAnchor="end" className="chart-axis-label chart-y-label">{Math.round(tick * 100)}%</text>
            </g>
          ))}
          {actualArea ? <path d={actualArea} fill="url(#actualArea)" /> : null}
          {series.map(({ key, color, dash }) => (
            <path key={key} d={monotonePath(valuesFor(key))} fill="none" stroke={color} strokeWidth={key === "actual" ? 5 : 3.5} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" filter={key === "actual" ? "url(#curveGlow)" : undefined} />
          ))}

          {latestActualIndex >= 0 ? (
            <g>
              <line className="data-date-marker" x1={x(latestActualIndex)} x2={x(latestActualIndex)} y1={top} y2={top + plotHeight} />
              <text className="data-date-label" x={Math.min(x(latestActualIndex) + 10, width - 122)} y={top + 19}>{t("Data date")}</text>
            </g>
          ) : null}

          {prepared.map((point, index) => {
            const dateLabel = new Date(`${point.date}T00:00:00Z`).toLocaleDateString(dateLocale, { day: granularity === "weekly" ? "2-digit" : undefined, month: "short", year: "2-digit", timeZone: "UTC" });
            const label = granularity === "weekly" ? `W${String(projectReportingWeek(point.date)).padStart(2, "0")} · ${dateLabel}` : dateLabel;
            const showLabel = index === 0 || index === prepared.length - 1 || index === latestActualIndex || index % labelEvery === 0;
            return (
              <g key={`${point.date}-${index}`}>
                <rect className="chart-hover-column" x={Math.max(left, x(index) - Math.max(7, plotWidth / Math.max(2, prepared.length) / 2))} y={top} width={Math.max(14, plotWidth / Math.max(2, prepared.length))} height={plotHeight} onMouseEnter={() => setHoveredIndex(index)} />
                {point.baseline !== null ? <circle cx={x(index)} cy={y(point.baseline)} r={hoveredIndex === index ? 4.5 : 2.2} className="baseline-point"><title>{`${t("Approved baseline")}: ${(point.baseline * 100).toFixed(2)}%`}</title></circle> : null}
                {point.actual !== null ? <circle cx={x(index)} cy={y(point.actual)} r={index === latestActualIndex || hoveredIndex === index ? 5.2 : 3} className="actual-point"><title>{`${t("Actual cumulative")}: ${(point.actual * 100).toFixed(2)}%`}</title></circle> : null}
                {showLabel ? <text x={x(index)} y={height - (granularity === "weekly" ? 54 : 32)} textAnchor={granularity === "weekly" ? "end" : "middle"} transform={granularity === "weekly" ? `rotate(-52 ${x(index)} ${height - 54})` : undefined} className="chart-axis-label chart-period-label">{label}</text> : null}
              </g>
            );
          })}

          {hover && hoveredIndex !== null ? (
            <g className="scurve-tooltip" pointerEvents="none">
              <line className="scurve-hover-line" x1={x(hoveredIndex)} x2={x(hoveredIndex)} y1={top} y2={top + plotHeight} />
              <rect className="scurve-tooltip-box" x={Math.min(Math.max(x(hoveredIndex) - 88, left + 6), width - right - 182)} y={top + 12} width="176" height="76" rx="10" />
              <text className="scurve-tooltip-date" x={Math.min(Math.max(x(hoveredIndex), left + 94), width - right - 94)} y={top + 34} textAnchor="middle">{new Date(`${hover.date}T00:00:00Z`).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</text>
              <text className="scurve-tooltip-baseline" x={Math.min(Math.max(x(hoveredIndex), left + 94), width - right - 94)} y={top + 56} textAnchor="middle">{t("Baseline")}: {hover.baseline === null ? "—" : `${(hover.baseline * 100).toFixed(2)}%`}</text>
              <text className="scurve-tooltip-actual" x={Math.min(Math.max(x(hoveredIndex), left + 94), width - right - 94)} y={top + 76} textAnchor="middle">{t("Actual")}: {hover.actual === null ? "—" : `${(hover.actual * 100).toFixed(2)}%`}</text>
            </g>
          ) : null}
        </svg>
      </div>
      <div className="chart-legend executive-chart-legend">
        {series.map((item) => <span key={item.key}><i className={`legend-line legend-${item.key}`} /> {t(item.label)}</span>)}
        <span className="chart-method-badge">{t("Cumulative · baseline controlled")}</span>
        <span className="chart-hover-hint">{t("Hover chart for values")}</span>
      </div>
    </div>
  );
}
