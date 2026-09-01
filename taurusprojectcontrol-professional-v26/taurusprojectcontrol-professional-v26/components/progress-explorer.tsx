"use client";

import { useMemo, useState } from "react";
import { LanguageSwitcher, useLanguage } from "@/components/language-provider";
import { ScurveChart } from "@/components/scurve-chart";
import {
  DISCIPLINE_ORDER,
  MONTHLY_SUBDISCIPLINES,
  WEEKLY_SUBDISCIPLINES,
  progressOrder
} from "@/lib/progress-structure";
import { progressPerformance, signalLabel } from "@/lib/progress-metrics";
import type { CurvePoint, ProgressSeriesPoint } from "@/lib/types";

type Grain = "year" | "monthly" | "weekly";

function ordered(values: string[], preferred: readonly string[] = []) {
  return [...new Set(values)].sort((a, b) => {
    const ai = progressOrder(a, preferred);
    const bi = progressOrder(b, preferred);
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

function makeCurve(points: ProgressSeriesPoint[], grain: Grain, year: string): CurvePoint[] {
  const source = grain === "weekly" ? "weekly" : "monthly";
  const filtered = points
    .filter((point) => point.frequency === source)
    .filter((point) => year === "all" || point.periodDate.startsWith(`${year}-`));
  const byDate = new Map<string, CurvePoint>();
  for (const point of filtered) {
    const date = point.periodDate;
    const entry = byDate.get(date) ?? { date, baseline: null, planned: null, actual: null };
    if (point.measure === "baseline" || point.measure === "actual") {
      const value = point.cumulativeValue ?? point.incrementalValue;
      if (value !== null) entry[point.measure] = value;
    }
    byDate.set(date, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

function varianceDays(value: number | null) {
  if (value === null) return "—";
  if (value === 0) return "0 days";
  return `${value > 0 ? "+" : ""}${value} days`;
}

export function ProgressExplorer({ series, fallbackCurve }: {
  series: ProgressSeriesPoint[];
  fallbackCurve: CurvePoint[];
}) {
  const { locale, t } = useLanguage();
  const [grain, setGrain] = useState<Grain>("year");
  const [disciplineChoice, setDisciplineChoice] = useState("Overall");
  const [subdisciplineChoice, setSubdisciplineChoice] = useState("__all__");
  const [year, setYear] = useState("all");

  const sourceFrequency = grain === "weekly" ? "weekly" : "monthly";
  const frequencyPoints = useMemo(
    () => series.filter((point) => point.frequency === sourceFrequency),
    [series, sourceFrequency]
  );
  const preferredDisciplines = sourceFrequency === "weekly"
    ? ["Engineering", "Construction"]
    : DISCIPLINE_ORDER;
  const disciplines = useMemo(() => {
    const detected = frequencyPoints
      .filter((point) => point.cumulativeValue !== null || point.incrementalValue !== null)
      .map((point) => point.discipline);
    if (!detected.length && sourceFrequency === "monthly" && !series.length) return ["Overall"];
    return ordered(detected, preferredDisciplines);
  }, [frequencyPoints, preferredDisciplines, series.length, sourceFrequency]);
  const discipline = disciplines.includes(disciplineChoice)
    ? disciplineChoice
    : (disciplines.includes("Overall") ? "Overall" : disciplines[0] ?? "");
  const disciplinePoints = frequencyPoints.filter((point) => point.discipline === discipline);
  const preferredSubdisciplines = sourceFrequency === "weekly"
    ? WEEKLY_SUBDISCIPLINES[discipline] ?? []
    : MONTHLY_SUBDISCIPLINES[discipline] ?? [];
  const subdisciplines = ordered(
    disciplinePoints.map((point) => point.subdiscipline).filter((value): value is string => Boolean(value)),
    preferredSubdisciplines
  );
  const subdiscipline = subdisciplineChoice === "__all__" || subdisciplines.includes(subdisciplineChoice)
    ? subdisciplineChoice
    : "__all__";
  const selected = disciplinePoints.filter((point) =>
    subdiscipline === "__all__" ? point.subdiscipline === null : point.subdiscipline === subdiscipline
  );
  const years = ordered([
    ...selected.map((point) => point.periodDate.slice(0, 4)),
    ...(!series.length && grain !== "weekly" ? fallbackCurve.map((point) => point.date.slice(0, 4)) : [])
  ]);
  const curve = makeCurve(selected, grain, year);
  const fallbackForGrain = grain === "weekly"
    ? []
    : fallbackCurve.filter((point) => year === "all" || point.date.startsWith(`${year}-`));
  const displayedCurve = series.length ? curve : fallbackForGrain;
  const performance = progressPerformance(displayedCurve);
  const localizedDate = (value: string | null) => {
    if (!value) return "—";
    return new Date(`${value}T00:00:00Z`).toLocaleDateString(
      locale === "ar" ? "ar-IQ" : locale === "ku" ? "ckb-IQ" : "en-GB",
      { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }
    );
  };

  const structure = useMemo(() => {
    const groups = new Map<string, ProgressSeriesPoint[]>();
    for (const point of series) {
      const key = [point.frequency, point.discipline, point.subdiscipline ?? ""].join("|");
      groups.set(key, [...(groups.get(key) ?? []), point]);
    }
    return [...groups.entries()].map(([key, points]) => {
      const [frequency, groupDiscipline, groupSubdiscipline] = key.split("|");
      const groupCurve = makeCurve(points, frequency === "weekly" ? "weekly" : "monthly", "all");
      return {
        key,
        frequency,
        discipline: groupDiscipline,
        subdiscipline: groupSubdiscipline || "All",
        performance: progressPerformance(groupCurve)
      };
    }).sort((a, b) => {
      if (a.frequency !== b.frequency) return a.frequency === "monthly" ? -1 : 1;
      const disciplineOrder = progressOrder(a.discipline, DISCIPLINE_ORDER) - progressOrder(b.discipline, DISCIPLINE_ORDER);
      if (disciplineOrder) return disciplineOrder;
      const subOrder = a.frequency === "weekly"
        ? WEEKLY_SUBDISCIPLINES[a.discipline] ?? []
        : MONTHLY_SUBDISCIPLINES[a.discipline] ?? [];
      return progressOrder(a.subdiscipline, subOrder) - progressOrder(b.subdiscipline, subOrder);
    });
  }, [series]);

  const signal = signalLabel(performance.signal);
  return (
    <>
      <section className="panel progress-explorer premium-panel">
        <div className="panel-heading progress-explorer-heading">
          <div><span className="eyebrow">{t("CONTROLLED PROGRESS CURVE")}</span><h2>{t("Project S-curve explorer")}</h2></div>
          <div className="progress-heading-actions">
            <LanguageSwitcher compact />
            <div className="segmented">
              {(["year", "monthly", "weekly"] as Grain[]).map((item) => (
                <button className={grain === item ? "selected" : ""} key={item} onClick={() => {
                  const nextFrequency = item === "weekly" ? "weekly" : "monthly";
                  const nextPreferred = nextFrequency === "weekly" ? ["Engineering", "Construction"] : [...DISCIPLINE_ORDER];
                  const nextDisciplines = ordered(
                    series.filter((point) => point.frequency === nextFrequency).map((point) => point.discipline),
                    nextPreferred
                  );
                  setGrain(item);
                  setDisciplineChoice(nextDisciplines.includes("Overall") ? "Overall" : nextDisciplines[0] ?? "");
                  setSubdisciplineChoice("__all__");
                  setYear("all");
                }} type="button">
                  {t(item === "year" ? "Year" : item === "monthly" ? "Month" : "Week")}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="progress-filter-grid">
          <label><span>{t("Discipline")}</span><select disabled={!disciplines.length} value={discipline} onChange={(event) => { setDisciplineChoice(event.target.value); setSubdisciplineChoice("__all__"); }}>
            {!disciplines.length ? <option value="">{t("No weekly data")}</option> : null}
            {disciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}
          </select></label>
          <label><span>{t("Sub-discipline")}</span><select value={subdiscipline} onChange={(event) => setSubdisciplineChoice(event.target.value)}>
            <option value="__all__">{subdisciplines.length ? `${t(discipline)} — ${t("Total")}` : t("Overall total")}</option>
            {subdisciplines.map((value) => <option key={value} value={value}>{t(value)}</option>)}
          </select></label>
          <label><span>{t("Displayed years")}</span><select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">{t("All years")}</option>
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></label>
        </div>
        {!series.length ? <div className="validation-warning">The discipline hierarchy is ready. Publish the progress/MDR workbook to load its cumulative monthly and weekly values.</div> : null}
        <div className={`performance-signal performance-signal-${performance.signal}`}>
          <div><small>{t("Schedule status")}</small><strong>{t(signal)}</strong></div>
          <span>SPI {performance.spi === null ? "—" : performance.spi.toFixed(3)}</span>
        </div>
        <div className="selected-progress-kpis">
          <span><small>{t("Actual")}</small><strong>{percent(performance.actual)}</strong></span>
          <span><small>{t("Baseline at actual")}</small><strong>{percent(performance.baseline)}</strong></span>
          <span><small>SPI</small><strong>{performance.spi === null ? "—" : performance.spi.toFixed(3)}</strong></span>
          <span><small>SV</small><strong>{performance.sv === null ? "—" : `${(performance.sv * 100).toFixed(2)} pp`}</strong></span>
          <span><small>{t("Expected finish")}</small><strong>{localizedDate(performance.expectedFinish)}</strong></span>
          <span><small>{t("Finish variance")}</small><strong>{varianceDays(performance.finishVarianceDays)}</strong></span>
        </div>
        {!displayedCurve.length ? (
          <div className="validation-warning">No cumulative baseline and actual curve is published for this selection.</div>
        ) : <ScurveChart points={displayedCurve} granularity={grain} />}
      </section>

      {structure.length ? (
        <section className="panel progress-structure-panel">
          <div className="panel-heading"><div><span className="eyebrow">{t("WORKBOOK STRUCTURE")}</span><h2>{t("All disciplines and sub-disciplines")}</h2></div><span className="status-pill status-ready">{structure.length} {t("curves")}</span></div>
          <div className="responsive-table"><table className="activity-table"><thead><tr><th>{t("Frequency")}</th><th>{t("Discipline")}</th><th>{t("Sub-discipline")}</th><th>{t("Baseline at actual")}</th><th>{t("Actual")}</th><th>SPI</th><th>{t("Expected finish")}</th></tr></thead><tbody>
            {structure.map((row) => <tr key={row.key}><td>{t(row.frequency === "weekly" ? "Weekly" : "Monthly")}</td><td><strong>{t(row.discipline)}</strong></td><td>{t(row.subdiscipline)}</td><td>{percent(row.performance.baseline)}</td><td>{percent(row.performance.actual)}</td><td>{row.performance.spi === null ? "—" : row.performance.spi.toFixed(3)}</td><td>{localizedDate(row.performance.expectedFinish)}</td></tr>)}
          </tbody></table></div>
        </section>
      ) : null}
    </>
  );
}
