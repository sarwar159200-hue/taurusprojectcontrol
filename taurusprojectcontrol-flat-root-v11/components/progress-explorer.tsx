"use client";

import { useMemo, useState } from "react";
import { ScurveChart } from "@/components/scurve-chart";
import {
  evaluateProgress,
  makeProgressCurve,
  progressPeriodLabel,
  PROJECT_WEEK_START_DATE,
  PROJECT_WEEK_START_NUMBER,
  projectWeekLabel,
  yearlyCurve,
  type ProgressGrain
} from "@/lib/progress-analytics";
import {
  DISCIPLINE_ORDER,
  MONTHLY_SUBDISCIPLINES,
  WEEKLY_SUBDISCIPLINES,
  progressOrder
} from "@/lib/progress-structure";
import type { CurvePoint, ProgressSeriesPoint } from "@/lib/types";

function ordered(values: string[], preferred: readonly string[] = []) {
  return [...new Set(values)].sort((a, b) => {
    const ai = progressOrder(a, preferred);
    const bi = progressOrder(b, preferred);
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

export function ProgressExplorer({ series, fallbackCurve, variant = "full" }: {
  series: ProgressSeriesPoint[];
  fallbackCurve: CurvePoint[];
  variant?: "full" | "overview";
}) {
  const [grain, setGrain] = useState<ProgressGrain>("monthly");
  const [disciplineChoice, setDisciplineChoice] = useState("Overall");
  const [subdisciplineChoice, setSubdisciplineChoice] = useState("__all__");
  const [year, setYear] = useState("all");

  const sourceFrequency = grain === "weekly" ? "weekly" : "monthly";
  const frequencyPoints = series.filter((point) => point.frequency === sourceFrequency);
  const availableDisciplines = sourceFrequency === "weekly"
    ? ["Engineering", "Construction"]
    : [...DISCIPLINE_ORDER];
  const disciplines = ordered(
    [...availableDisciplines, ...frequencyPoints.map((point) => point.discipline)],
    sourceFrequency === "weekly" ? availableDisciplines : DISCIPLINE_ORDER
  );
  const discipline = disciplines.includes(disciplineChoice)
    ? disciplineChoice
    : (disciplines.includes("Overall") ? "Overall" : disciplines[0] ?? "Overall");
  const disciplinePoints = frequencyPoints.filter((point) => point.discipline === discipline);
  const preferredSubdisciplines = sourceFrequency === "weekly"
    ? WEEKLY_SUBDISCIPLINES[discipline] ?? []
    : MONTHLY_SUBDISCIPLINES[discipline] ?? [];
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
  const selected = disciplinePoints.filter((point) =>
    subdiscipline === "__all__" ? point.subdiscipline === null : point.subdiscipline === subdiscipline
  );
  const years = ordered([
    ...selected.map((point) => point.periodDate.slice(0, 4)),
    ...(!series.length && grain !== "weekly" ? fallbackCurve.map((point) => point.date.slice(0, 4)) : [])
  ]);
  const curve = makeProgressCurve(selected, grain, year);
  const fallbackForGrain = grain === "weekly"
    ? []
    : grain === "year"
      ? yearlyCurve(fallbackCurve.filter((point) => year === "all" || point.date.startsWith(`${year}-`)))
      : fallbackCurve.filter((point) => year === "all" || point.date.startsWith(`${year}-`));
  const displayedCurve = series.length ? curve : fallbackForGrain;
  // Year view is visually aggregated, but SPI/SV must still use the plan at
  // the exact latest date where actual progress exists.
  const evaluationCurve = grain === "year"
    ? series.length
      ? makeProgressCurve(selected, "monthly", year)
      : fallbackCurve.filter((point) => year === "all" || point.date.startsWith(`${year}-`))
    : displayedCurve;
  const evaluated = evaluateProgress(evaluationCurve);
  const { planned, actual, spi, sv } = evaluated;
  const periodStart = displayedCurve[0]?.date ?? null;
  const periodFinish = displayedCurve.at(-1)?.date ?? null;
  const isOverview = variant === "overview";

  const structure = useMemo(() => {
    if (isOverview) return [];
    const groups = new Map<string, ProgressSeriesPoint[]>();
    for (const point of series) {
      const key = [point.frequency, point.discipline, point.subdiscipline ?? ""].join("|");
      groups.set(key, [...(groups.get(key) ?? []), point]);
    }
    return [...groups.entries()].map(([key, points]) => {
      const [frequency, groupDiscipline, groupSubdiscipline] = key.split("|");
      const groupCurve = makeProgressCurve(points, frequency === "weekly" ? "weekly" : "monthly", "all");
      const groupValues = evaluateProgress(groupCurve);
      const groupPlanned = groupValues.planned;
      const groupActual = groupValues.actual;
      return {
        key,
        frequency,
        discipline: groupDiscipline,
        subdiscipline: groupSubdiscipline || "All",
        planned: groupPlanned,
        actual: groupActual,
        spi: groupActual !== null && groupPlanned ? groupActual / groupPlanned : null
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
  }, [isOverview, series]);

  return (
    <>
      {isOverview ? <article className="panel progress-explorer overview-progress-explorer wide-panel">
        <div className="panel-heading progress-primary-heading">
          <div><span className="eyebrow">PERFORMANCE CURVE</span><h2>{discipline}{subdiscipline === "__all__" ? "" : ` · ${subdiscipline}`} {grain === "year" ? "yearly" : grain === "weekly" ? "weekly" : "monthly"} S-curve</h2></div>
          <div className="segmented grain-tabs">
            {(["year", "monthly", "weekly"] as ProgressGrain[]).map((item) => <button className={grain === item ? "selected" : ""} key={item} onClick={() => { setGrain(item); setDisciplineChoice(item === "weekly" ? "Engineering" : "Overall"); setSubdisciplineChoice("__all__"); setYear("all"); }} type="button">{item === "year" ? "Year" : item === "monthly" ? "Month" : "Week"}</button>)}
          </div>
        </div>
        <ProgressControls disciplines={disciplines} discipline={discipline} setDiscipline={(value) => { setDisciplineChoice(value); setSubdisciplineChoice("__all__"); }} subdisciplines={subdisciplines} subdiscipline={subdiscipline} setSubdiscipline={setSubdisciplineChoice} years={years} year={year} setYear={setYear} />
        <ProgressSummary actual={actual} planned={planned} spi={spi} sv={sv} evaluatedDate={evaluated.date} periodStart={periodStart} periodFinish={periodFinish} grain={grain} />
        {grain === "weekly" ? <div className="project-week-note">Project calendar starts at Week {PROJECT_WEEK_START_NUMBER} ({progressPeriodLabel(PROJECT_WEEK_START_DATE, "weekly").split(" · ").at(-1)}). {projectWeekLabel("2026-02-05")} = 05-Feb-2026.</div> : null}
        {!displayedCurve.length ? <div className="validation-warning">No {grain === "weekly" ? "weekly" : grain === "year" ? "yearly" : "monthly"} cumulative curve is published for this selection.</div> : <ScurveChart points={displayedCurve} granularity={grain} />}
      </article> : <section className="panel progress-explorer">
        <div className="panel-heading">
          <div><span className="eyebrow">CONTROLLED PROGRESS CURVE</span><h2>{discipline}{subdiscipline === "__all__" ? "" : ` · ${subdiscipline}`} S-curve</h2></div>
          <div className="segmented">
            {(["year", "monthly", "weekly"] as ProgressGrain[]).map((item) => (
              <button className={grain === item ? "selected" : ""} key={item} onClick={() => { setGrain(item); setDisciplineChoice(item === "weekly" ? "Engineering" : "Overall"); setSubdisciplineChoice("__all__"); setYear("all"); }} type="button">
                {item === "year" ? "Year" : item === "monthly" ? "Month" : "Week"}
              </button>
            ))}
          </div>
        </div>
        <ProgressControls disciplines={disciplines} discipline={discipline} setDiscipline={(value) => { setDisciplineChoice(value); setSubdisciplineChoice("__all__"); }} subdisciplines={subdisciplines} subdiscipline={subdiscipline} setSubdiscipline={setSubdisciplineChoice} years={years} year={year} setYear={setYear} />
        {!series.length ? <div className="validation-warning">The discipline hierarchy is ready. Publish the progress/MDR workbook to load its cumulative monthly and weekly values.</div> : null}
        <ProgressSummary actual={actual} planned={planned} spi={spi} sv={sv} evaluatedDate={evaluated.date} periodStart={periodStart} periodFinish={periodFinish} grain={grain} />
        {grain === "weekly" ? <div className="project-week-note">Project weeks start at Week {PROJECT_WEEK_START_NUMBER}; {projectWeekLabel("2026-02-05")} is 05-Feb-2026.</div> : null}
        {!displayedCurve.length ? (
          <div className="validation-warning">No {grain === "weekly" ? "weekly" : grain === "year" ? "yearly" : "monthly"} cumulative curve is published for this selection.</div>
        ) : <ScurveChart points={displayedCurve} granularity={grain} />}
      </section>}

      {!isOverview && structure.length ? (
        <section className="panel progress-structure-panel">
          <div className="panel-heading"><div><span className="eyebrow">WORKBOOK STRUCTURE</span><h2>All disciplines and sub-disciplines</h2></div><span className="status-pill status-ready">{structure.length} curves</span></div>
          <div className="responsive-table"><table className="activity-table"><thead><tr><th>Frequency</th><th>Discipline</th><th>Sub-discipline</th><th>Planned at actual</th><th>Actual</th><th>SPI</th></tr></thead><tbody>
            {structure.map((row) => <tr key={row.key}><td>{row.frequency === "weekly" ? "Weekly" : "Monthly"}</td><td><strong>{row.discipline}</strong></td><td>{row.subdiscipline}</td><td>{percent(row.planned)}</td><td>{percent(row.actual)}</td><td>{row.spi === null ? "—" : row.spi.toFixed(3)}</td></tr>)}
          </tbody></table></div>
        </section>
      ) : null}
    </>
  );
}

function ProgressControls({ disciplines, discipline, setDiscipline, subdisciplines, subdiscipline, setSubdiscipline, years, year, setYear }: {
  disciplines: string[];
  discipline: string;
  setDiscipline: (value: string) => void;
  subdisciplines: string[];
  subdiscipline: string;
  setSubdiscipline: (value: string) => void;
  years: string[];
  year: string;
  setYear: (value: string) => void;
}) {
  return <div className="progress-control-stack">
    <div className="progress-control-row"><span className="progress-control-label">Discipline</span><div className="segmented discipline-tabs">{disciplines.map((value) => <button className={discipline === value ? "selected" : ""} key={value} onClick={() => setDiscipline(value)} type="button">{value}</button>)}</div></div>
    <div className="progress-control-row"><span className="progress-control-label">Sub-discipline</span><div className="segmented subdiscipline-tabs"><button className={subdiscipline === "__all__" ? "selected" : ""} onClick={() => setSubdiscipline("__all__")} type="button">{subdisciplines.length ? `${discipline} total` : "Total"}</button>{subdisciplines.map((value) => <button className={subdiscipline === value ? "selected" : ""} key={value} onClick={() => setSubdiscipline(value)} type="button">{value}</button>)}</div>{!subdisciplines.length ? <small>No sub-disciplines are defined for this total curve.</small> : null}</div>
    <label className="progress-year-filter"><span>Displayed years</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All years</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
  </div>;
}

function ProgressSummary({ actual, planned, spi, sv, evaluatedDate, periodStart, periodFinish, grain }: {
  actual: number | null;
  planned: number | null;
  spi: number | null;
  sv: number | null;
  evaluatedDate: string | null;
  periodStart: string | null;
  periodFinish: string | null;
  grain: ProgressGrain;
}) {
  return <div className="selected-progress-kpis">
    <span><small>Actual</small><strong>{percent(actual)}</strong></span>
    <span><small>Planned at actual</small><strong>{percent(planned)}</strong></span>
    <span><small>SPI</small><strong>{spi === null ? "—" : spi.toFixed(3)}</strong></span>
    <span><small>SV</small><strong>{sv === null ? "—" : `${(sv * 100).toFixed(2)} pp`}</strong></span>
    <span><small>SPI date</small><strong>{evaluatedDate ? progressPeriodLabel(evaluatedDate, grain) : "—"}</strong></span>
    <span><small>Displayed range</small><strong>{periodStart && periodFinish ? `${progressPeriodLabel(periodStart, grain)} – ${progressPeriodLabel(periodFinish, grain)}` : "—"}</strong></span>
  </div>;
}
