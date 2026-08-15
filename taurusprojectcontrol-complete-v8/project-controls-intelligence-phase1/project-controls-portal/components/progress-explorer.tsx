"use client";

import { useMemo, useState } from "react";
import { ScurveChart } from "@/components/scurve-chart";
import {
  DISCIPLINE_ORDER,
  MONTHLY_SUBDISCIPLINES,
  WEEKLY_SUBDISCIPLINES,
  progressOrder
} from "@/lib/progress-structure";
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
    if (point.measure === "baseline" || point.measure === "planned" || point.measure === "actual") {
      const value = point.cumulativeValue ?? point.incrementalValue;
      if (value !== null) entry[point.measure] = value;
    }
    byDate.set(date, entry);
  }
  const dated = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (grain !== "year") return dated;

  const byYear = new Map<string, CurvePoint[]>();
  for (const point of dated) {
    const pointYear = point.date.slice(0, 4);
    byYear.set(pointYear, [...(byYear.get(pointYear) ?? []), point]);
  }
  return [...byYear.entries()].map(([pointYear, yearPoints]) => {
    const latestActual = [...yearPoints].reverse().find((point) => point.actual !== null);
    const selected = latestActual ?? yearPoints.at(-1)!;
    return {
      date: `${pointYear}-12-31`,
      baseline: selected.baseline,
      planned: selected.planned,
      actual: selected.actual
    };
  });
}

function evaluationValues(points: CurvePoint[]) {
  const reached = [...points].reverse().find((point) => point.actual !== null) ?? null;
  const planned = reached?.planned ?? reached?.baseline ?? null;
  return {
    date: reached?.date ?? null,
    actual: reached?.actual ?? null,
    planned,
    planSource: reached?.planned !== null && reached?.planned !== undefined
      ? "Current plan"
      : reached?.baseline !== null && reached?.baseline !== undefined
        ? "Baseline (weekly plan)"
        : "No plan"
  };
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

export function ProgressExplorer({ series, fallbackCurve }: {
  series: ProgressSeriesPoint[];
  fallbackCurve: CurvePoint[];
}) {
  const [grain, setGrain] = useState<Grain>("monthly");
  const [disciplineChoice, setDisciplineChoice] = useState("Overall");
  const [subdisciplineChoice, setSubdisciplineChoice] = useState("__all__");
  const [year, setYear] = useState("all");

  const sourceFrequency = grain === "weekly" ? "weekly" : "monthly";
  const frequencyPoints = series.filter((point) => point.frequency === sourceFrequency);
  const disciplines = ordered(frequencyPoints.map((point) => point.discipline), DISCIPLINE_ORDER);
  const discipline = disciplines.includes(disciplineChoice)
    ? disciplineChoice
    : (disciplines.includes("Overall") ? "Overall" : disciplines[0] ?? "Overall");
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
  const years = ordered(selected.map((point) => point.periodDate.slice(0, 4)));
  const curve = makeCurve(selected, grain, year);
  const displayedCurve = series.length ? curve : fallbackCurve;
  const evaluated = evaluationValues(displayedCurve);
  const planned = evaluated.planned;
  const actual = evaluated.actual;
  const spi = actual !== null && planned ? actual / planned : null;
  const sv = actual !== null && planned !== null ? actual - planned : null;

  const structure = useMemo(() => {
    const groups = new Map<string, ProgressSeriesPoint[]>();
    for (const point of series) {
      const key = [point.frequency, point.discipline, point.subdiscipline ?? ""].join("|");
      groups.set(key, [...(groups.get(key) ?? []), point]);
    }
    return [...groups.entries()].map(([key, points]) => {
      const [frequency, groupDiscipline, groupSubdiscipline] = key.split("|");
      const groupCurve = makeCurve(points, frequency === "weekly" ? "weekly" : "monthly", "all");
      const groupValues = evaluationValues(groupCurve);
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
  }, [series]);

  return (
    <>
      <section className="panel progress-explorer">
        <div className="panel-heading">
          <div><span className="eyebrow">CONTROLLED PROGRESS CURVE</span><h2>Project S-curve explorer</h2></div>
          <div className="segmented">
            {(["year", "monthly", "weekly"] as Grain[]).map((item) => (
              <button className={grain === item ? "selected" : ""} key={item} onClick={() => { setGrain(item); setDisciplineChoice(item === "weekly" ? "Engineering" : "Overall"); setSubdisciplineChoice("__all__"); setYear("all"); }} type="button">
                {item === "year" ? "Year" : item === "monthly" ? "Month" : "Week"}
              </button>
            ))}
          </div>
        </div>
        {series.length ? (
          <div className="progress-filter-grid">
            <label><span>Discipline</span><select value={discipline} onChange={(event) => { setDisciplineChoice(event.target.value); setSubdisciplineChoice("__all__"); }}>
              {disciplines.map((value) => <option key={value}>{value}</option>)}
            </select></label>
            <label><span>Sub-discipline</span><select value={subdiscipline} onChange={(event) => setSubdisciplineChoice(event.target.value)}>
              <option value="__all__">{subdisciplines.length ? `${discipline} total` : "Overall total"}</option>
              {subdisciplines.map((value) => <option key={value}>{value}</option>)}
            </select></label>
            <label><span>Year range</span><select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">All years</option>
              {years.map((value) => <option key={value}>{value}</option>)}
            </select></label>
          </div>
        ) : <div className="validation-warning">Upload and publish the progress/MDR workbook to activate every curve and filter.</div>}
        <div className="selected-progress-kpis">
          <span><small>Actual</small><strong>{percent(actual)}</strong></span>
          <span><small>Planned</small><strong>{percent(planned)}</strong></span>
          <span><small>SPI</small><strong>{spi === null ? "—" : spi.toFixed(3)}</strong></span>
          <span><small>SV</small><strong>{sv === null ? "—" : `${(sv * 100).toFixed(2)} pp`}</strong></span>
          <span><small>SPI date</small><strong>{evaluated.date ?? "—"}</strong></span>
          <span><small>Plan source</small><strong>{evaluated.planSource}</strong></span>
        </div>
        {series.length && !curve.length ? (
          <div className="validation-warning">No {grain === "weekly" ? "weekly" : "monthly"} curve exists for this selection in the uploaded workbook. Choose another discipline or sub-discipline.</div>
        ) : <ScurveChart points={displayedCurve} granularity={grain} />}
      </section>

      {structure.length ? (
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
