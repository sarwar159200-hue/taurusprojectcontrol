"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { ProgressGauge } from "@/components/progress-gauge";
import { ScurveChart } from "@/components/scurve-chart";
import { useLanguage } from "@/components/language-provider";
import {
  DISCIPLINE_ORDER,
  MONTHLY_SUBDISCIPLINES,
  WEEKLY_SUBDISCIPLINES,
  progressOrder
} from "@/lib/progress-structure";
import { progressPerformance, signalLabel } from "@/lib/progress-metrics";
import type { CurvePoint, ProgressSeriesPoint } from "@/lib/types";

type Frequency = "monthly" | "weekly";

function ordered(values: string[], preferred: readonly string[] = []) {
  return [...new Set(values)].sort((a, b) => {
    const difference = progressOrder(a, preferred) - progressOrder(b, preferred);
    return difference || a.localeCompare(b);
  });
}

function curveFor(points: ProgressSeriesPoint[]): CurvePoint[] {
  const byDate = new Map<string, CurvePoint>();
  for (const point of points) {
    const entry = byDate.get(point.periodDate) ?? {
      date: point.periodDate,
      baseline: null,
      planned: null,
      actual: null
    };
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
  const [disciplineChoice, setDisciplineChoice] = useState("Overall");
  const [subdisciplineChoice, setSubdisciplineChoice] = useState("__all__");
  const source = progressSeries.filter((point) => point.frequency === frequency);
  const preferredDisciplines = frequency === "weekly"
    ? ["Engineering", "Construction"]
    : [...DISCIPLINE_ORDER];
  const disciplines = ordered(
    [...preferredDisciplines, ...source.map((point) => point.discipline)],
    preferredDisciplines
  );
  const discipline = disciplines.includes(disciplineChoice)
    ? disciplineChoice
    : preferredDisciplines[0];
  const preferredSubdisciplines = frequency === "weekly"
    ? WEEKLY_SUBDISCIPLINES[discipline] ?? []
    : MONTHLY_SUBDISCIPLINES[discipline] ?? [];
  const disciplinePoints = source.filter((point) => point.discipline === discipline);
  const subdisciplines = ordered(
    [
      ...preferredSubdisciplines,
      ...disciplinePoints.map((point) => point.subdiscipline).filter((value): value is string => Boolean(value))
    ],
    preferredSubdisciplines
  );
  const subdiscipline = subdisciplineChoice === "__all__" || subdisciplines.includes(subdisciplineChoice)
    ? subdisciplineChoice
    : "__all__";
  const selectedPoints = disciplinePoints.filter((point) =>
    subdiscipline === "__all__" ? point.subdiscipline === null : point.subdiscipline === subdiscipline
  );
  const selectedCurve = curveFor(selectedPoints);
  const curve = selectedCurve.length
    ? selectedCurve
    : frequency === "monthly" && discipline === "Overall" && subdiscipline === "__all__"
      ? fallbackCurve
      : [];
  const performance = progressPerformance(curve);
  const signal = signalLabel(performance.signal);
  const dateLocale = locale === "ar" ? "ar-IQ" : locale === "ku" ? "ckb-IQ" : "en-GB";
  const date = (value: string | null) => value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : t("Pending");
  const title = subdiscipline === "__all__"
    ? `${t(discipline)} — ${t("Total")}`
    : `${t(discipline)} — ${t(subdiscipline)}`;

  const structureCount = useMemo(() => {
    const keys = new Set(progressSeries.map((point) => [point.frequency, point.discipline, point.subdiscipline ?? ""].join("|")));
    return keys.size;
  }, [progressSeries]);

  function selectFrequency(next: Frequency) {
    setFrequency(next);
    setDisciplineChoice(next === "weekly" ? "Engineering" : "Overall");
    setSubdisciplineChoice("__all__");
  }

  return (
    <>
      <section className="panel premium-panel executive-performance-panel">
        <div className="panel-heading executive-performance-heading">
          <div>
            <span className="eyebrow">{t("EXECUTIVE PROGRESS CONTROL")}</span>
            <h2>{t("Discipline performance and forecast")}</h2>
          </div>
          <div className="segmented">
            <button className={frequency === "monthly" ? "selected" : ""} onClick={() => selectFrequency("monthly")} type="button">{t("Monthly")}</button>
            <button className={frequency === "weekly" ? "selected" : ""} onClick={() => selectFrequency("weekly")} type="button">{t("Weekly")}</button>
          </div>
        </div>

        <div className="executive-filter-grid">
          <label>
            <span>{t("Discipline")}</span>
            <select value={discipline} onChange={(event) => { setDisciplineChoice(event.target.value); setSubdisciplineChoice("__all__"); }}>
              {disciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}
            </select>
          </label>
          <label>
            <span>{t("Sub-discipline")}</span>
            <select value={subdiscipline} onChange={(event) => setSubdisciplineChoice(event.target.value)}>
              <option value="__all__">{subdisciplines.length ? `${t(discipline)} — ${t("Total")}` : t("Overall total")}</option>
              {subdisciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}
            </select>
          </label>
          <div className="executive-selection-summary">
            <span>{t("Selected curve")}</span>
            <strong>{title}</strong>
            <small>{t(frequency === "monthly" ? "Monthly cumulative reporting" : "Weekly cumulative reporting")}</small>
          </div>
        </div>
      </section>

      <section className="executive-metric-grid">
        <ProgressGauge label="Actual progress" value={performance.actual} detail="Earned to data date" tone="green" />
        <ProgressGauge label="Baseline progress" value={performance.baseline} detail="Approved baseline at data date" tone="blue" />
        <KpiCard label="SPI" value={performance.spi === null ? "—" : performance.spi.toFixed(3)} detail={t(signal)} tone={performance.signal === "ahead" ? "green" : performance.signal === "on-plan" ? "blue" : performance.signal === "slightly-behind" ? "amber" : "red"} />
        <KpiCard label="Schedule variance" value={performance.sv === null ? "—" : `${(performance.sv * 100).toFixed(2)} pp`} detail="Actual minus baseline" tone={(performance.sv ?? 0) >= 0 ? "green" : "red"} />
        <KpiCard label="Expected finish" value={date(performance.expectedFinish)} detail="Baseline-performance forecast" tone="amber" />
        <KpiCard label="Controlled documents" value={totalDocuments.toLocaleString(dateLocale)} detail={`${approvedDocuments.toLocaleString(dateLocale)} ${t("final approved")}`} />
        <KpiCard label="Critical activities" value={criticalActivities.toLocaleString(dateLocale)} detail={`${t("of")} ${scheduleActivities.toLocaleString(dateLocale)} ${t("activities")}`} tone="red" />
      </section>

      <section className="dashboard-grid main-dashboard-grid">
        <article className="panel wide-panel executive-curve-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">{t("PERFORMANCE CURVE")}</span><h2>{title}</h2></div>
            <span className="comparison-badge">{t("Baseline vs actual")}</span>
          </div>
          {curve.length
            ? <ScurveChart points={curve} granularity={frequency} />
            : <div className="empty-curve-message"><strong>{t("No cumulative curve is available for this selection.")}</strong><span>{t("Confirm that the matching worksheet is present in the uploaded workbook.")}</span></div>}
        </article>
        <article className="panel insight-panel">
          <div className="panel-heading"><div><span className="eyebrow">{t("CONTROL STATUS")}</span><h2>{t("Management signal")}</h2></div></div>
          <div className={`signal-card signal-${performance.signal}`}>
            <span>{t("SCHEDULE STATUS")}</span>
            <strong>{t(signal)}</strong>
            <p>SPI {performance.spi === null ? "—" : performance.spi.toFixed(3)} · SV {performance.sv === null ? "—" : `${(performance.sv * 100).toFixed(2)} pp`}</p>
          </div>
          <div className="metric-line"><span>{t("Baseline position")}</span><strong>{performance.baseline === null ? "—" : `${(performance.baseline * 100).toFixed(2)}%`}</strong></div>
          <div className="metric-line"><span>{t("Actual achieved")}</span><strong>{performance.actual === null ? "—" : `${(performance.actual * 100).toFixed(2)}%`}</strong></div>
          <div className="metric-line"><span>{t("Expected finish")}</span><strong>{date(performance.expectedFinish)}</strong></div>
          <div className="metric-line"><span>{t("Forecast variance")}</span><strong>{forecastDays(performance.finishVarianceDays)}</strong></div>
          <div className="data-quality"><i>✓</i><div><strong>{t("Workbook structure recognized")}</strong><span>{structureCount || 1} {t("controlled progress curves")}</span></div></div>
        </article>
      </section>
    </>
  );
}
