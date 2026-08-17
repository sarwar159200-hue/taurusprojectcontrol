"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { ProgressGauge } from "@/components/progress-gauge";
import { ScurveChart } from "@/components/scurve-chart";
import { useLanguage } from "@/components/language-provider";
import { progressPerformance, signalLabel } from "@/lib/progress-metrics";
import type { CurvePoint, ProgressSeriesPoint } from "@/lib/types";

type Frequency = "monthly" | "weekly";

function curveFor(points: ProgressSeriesPoint[]): CurvePoint[] {
  const byDate = new Map<string, CurvePoint>();
  for (const point of points) {
    const entry = byDate.get(point.periodDate) ?? { date: point.periodDate, baseline: null, planned: null, actual: null };
    if (point.measure === "baseline" || point.measure === "actual") {
      const value = point.cumulativeValue ?? point.incrementalValue;
      if (value !== null) entry[point.measure] = value;
    }
    byDate.set(point.periodDate, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function forecastDays(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value} days`;
}

export function ExecutivePerformanceOverview({
  fallbackCurve,
  progressSeries,
  totalDocuments,
  approvedDocuments,
  criticalActivities,
  scheduleActivities
}: {
  fallbackCurve: CurvePoint[];
  progressSeries: ProgressSeriesPoint[];
  totalDocuments: number;
  approvedDocuments: number;
  criticalActivities: number;
  scheduleActivities: number;
}) {
  const { locale, t } = useLanguage();
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const monthlyOverall = useMemo(() => curveFor(progressSeries.filter((point) => point.frequency === "monthly" && point.discipline === "Overall" && point.subdiscipline === null)), [progressSeries]);
  const weeklyOverall = useMemo(() => curveFor(progressSeries.filter((point) => point.frequency === "weekly" && point.discipline === "Overall" && point.subdiscipline === null)), [progressSeries]);
  const curve = frequency === "monthly" ? (monthlyOverall.length ? monthlyOverall : fallbackCurve) : (weeklyOverall.length ? weeklyOverall : fallbackCurve);
  const performance = progressPerformance(curve);
  const signal = signalLabel(performance.signal);
  const dateLocale = locale === "ar" ? "ar-IQ" : locale === "ku" ? "ckb-IQ" : "en-GB";
  const date = (value: string | null) => value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : t("Pending");
  const structureCount = useMemo(() => new Set(progressSeries.map((point) => [point.frequency, point.discipline, point.subdiscipline ?? ""].join("|"))).size, [progressSeries]);

  return (
    <>
      <section className="executive-metric-grid">
        <ProgressGauge label="Actual progress" value={performance.actual} detail="Earned to data date" tone="green" />
        <ProgressGauge label="Baseline progress" value={performance.baseline} detail="Planned to data date" tone="blue" />
        <KpiCard label="SPI" value={performance.spi === null ? "—" : performance.spi.toFixed(3)} detail={performance.signal === "ahead" ? "Ahead of baseline" : t(signal)} tone={performance.signal === "ahead" ? "green" : performance.signal === "on-plan" ? "blue" : performance.signal === "slightly-behind" ? "amber" : "red"} />
        <KpiCard label="Schedule variance" value={performance.sv === null ? "—" : `${performance.sv >= 0 ? "+" : ""}${(performance.sv * 100).toFixed(2)} PP`} detail={performance.sv !== null && performance.sv >= 0 ? "Ahead of baseline" : "Behind baseline"} tone={(performance.sv ?? 0) >= 0 ? "green" : "red"} />
        <KpiCard label="Forecast finish" value={date(performance.expectedFinish)} detail={performance.baselineFinish ? `${t("Baseline")} ${date(performance.baselineFinish)}` : "Baseline-performance forecast"} tone="amber" />
        <KpiCard label="Controlled documents" value={totalDocuments.toLocaleString(dateLocale)} detail={`${approvedDocuments.toLocaleString(dateLocale)} ${t("Final Approved")}`} />
        <KpiCard label="Critical activities" value={criticalActivities.toLocaleString(dateLocale)} detail={`${t("of")} ${scheduleActivities.toLocaleString(dateLocale)} ${t("activities")}`} tone="red" />
      </section>

      <section className="dashboard-grid main-dashboard-grid executive-snapshot-main-grid">
        <article className="panel wide-panel executive-curve-panel">
          <div className="panel-heading executive-curve-heading">
            <div><span className="eyebrow">{t("PERFORMANCE CURVE")}</span><h2>{t("Overall — Total")}</h2></div>
            <div className="segmented compact-segmented">
              <button className={frequency === "monthly" ? "selected" : ""} onClick={() => setFrequency("monthly")} type="button">{t("Monthly")}</button>
              <button className={frequency === "weekly" ? "selected" : ""} onClick={() => setFrequency("weekly")} type="button">{t("Weekly")}</button>
            </div>
          </div>
          {curve.length ? <ScurveChart points={curve} granularity={frequency} /> : <div className="empty-curve-message"><strong>{t("No cumulative curve is available for this selection.")}</strong></div>}
        </article>
        <article className="panel insight-panel">
          <div className="panel-heading"><div><span className="eyebrow">{t("CONTROL STATUS")}</span><h2>{t("Management Signal")}</h2></div></div>
          <div className={`signal-card signal-${performance.signal}`}>
            <span>{t("SCHEDULE STATUS")}</span>
            <strong>{performance.signal === "ahead" ? t("Ahead of Baseline") : t(signal)}</strong>
            <p>SPI {performance.spi === null ? "—" : performance.spi.toFixed(3)} · SV {performance.sv === null ? "—" : `${performance.sv >= 0 ? "+" : ""}${(performance.sv * 100).toFixed(2)} PP`}</p>
          </div>
          <div className="metric-line"><span>{t("Baseline Position")}</span><strong>{performance.baseline === null ? "—" : `${(performance.baseline * 100).toFixed(2)}%`}</strong></div>
          <div className="metric-line"><span>{t("Actual Achieved")}</span><strong>{performance.actual === null ? "—" : `${(performance.actual * 100).toFixed(2)}%`}</strong></div>
          <div className="metric-line"><span>{t("Expected Finish")}</span><strong>{date(performance.expectedFinish)}</strong></div>
          <div className="metric-line"><span>{t("Forecast Variance")}</span><strong>{forecastDays(performance.finishVarianceDays)}</strong></div>
          <div className="data-quality"><i>✓</i><div><strong>{t("Workbook structure recognized")}</strong><span>{structureCount || 1} {t("controlled progress curves")}</span></div></div>
        </article>
      </section>
    </>
  );
}
