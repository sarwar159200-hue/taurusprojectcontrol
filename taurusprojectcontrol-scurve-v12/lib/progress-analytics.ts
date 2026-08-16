import type { CurvePoint, ProgressSeriesPoint } from "./types";
import {
  DISCIPLINE_ORDER,
  MONTHLY_SUBDISCIPLINES,
  PROGRESS_WEIGHTS,
  WEEKLY_SUBDISCIPLINES,
  canonicalDiscipline,
  canonicalSubdiscipline,
  progressOrder
} from "./progress-structure";

export type ProgressGrain = "year" | "monthly" | "weekly";

// Taurus project weeks are numbered from the controlled project calendar,
// not ISO week numbers. This anchor makes 05-Feb-2026 Project Week 32.
export const PROJECT_WEEK_START_DATE = "2026-01-15";
export const PROJECT_WEEK_START_NUMBER = 29;

const DAY_MS = 86_400_000;

function seriesKey(point: Pick<ProgressSeriesPoint, "frequency" | "discipline" | "subdiscipline" | "measure" | "periodDate">) {
  return [point.frequency, point.discipline, point.subdiscipline ?? "", point.measure, point.periodDate].join("|");
}

function replaceWeightedTotal(
  points: Map<string, ProgressSeriesPoint>,
  frequency: ProgressSeriesPoint["frequency"],
  main: "Engineering" | "Procurement" | "Construction"
) {
  const weights = PROGRESS_WEIGHTS[main];
  const children = [...points.values()].filter((point) =>
    point.frequency === frequency &&
    canonicalDiscipline(point.discipline) === main &&
    point.subdiscipline !== null &&
    weights[canonicalSubdiscipline(point.subdiscipline)] !== undefined
  );
  if (!children.length) return;

  for (const [key, point] of points) {
    if (point.frequency === frequency && canonicalDiscipline(point.discipline) === main && point.subdiscipline === null) {
      points.delete(key);
    }
  }

  const totals = new Map<string, ProgressSeriesPoint>();
  for (const child of children) {
    const childName = canonicalSubdiscipline(child.subdiscipline!);
    const weight = weights[childName];
    const key = [child.measure, child.periodDate].join("|");
    const total = totals.get(key) ?? {
      frequency,
      area: main,
      discipline: main,
      subdiscipline: null,
      measure: child.measure,
      periodDate: child.periodDate,
      incrementalValue: null,
      cumulativeValue: null
    };
    if (child.incrementalValue !== null) {
      total.incrementalValue = (total.incrementalValue ?? 0) + child.incrementalValue * weight;
    }
    if (child.cumulativeValue !== null) {
      total.cumulativeValue = (total.cumulativeValue ?? 0) + child.cumulativeValue * weight;
    }
    totals.set(key, total);
  }
  for (const total of totals.values()) points.set(seriesKey(total), total);
}

function replaceWeightedOverall(points: Map<string, ProgressSeriesPoint>) {
  const weights = PROGRESS_WEIGHTS.Overall;
  const children = [...points.values()].filter((point) =>
    point.frequency === "monthly" &&
    point.subdiscipline === null &&
    canonicalDiscipline(point.discipline) !== "Overall" &&
    weights[canonicalDiscipline(point.discipline)] !== undefined
  );
  if (!children.length) return;

  for (const [key, point] of points) {
    if (point.frequency === "monthly" && canonicalDiscipline(point.discipline) === "Overall" && point.subdiscipline === null) {
      points.delete(key);
    }
  }

  const totals = new Map<string, ProgressSeriesPoint>();
  for (const child of children) {
    const discipline = canonicalDiscipline(child.discipline);
    const weight = weights[discipline];
    const key = [child.measure, child.periodDate].join("|");
    const total = totals.get(key) ?? {
      frequency: "monthly" as const,
      area: "Overall",
      discipline: "Overall",
      subdiscipline: null,
      measure: child.measure,
      periodDate: child.periodDate,
      incrementalValue: null,
      cumulativeValue: null
    };
    if (child.incrementalValue !== null) {
      total.incrementalValue = (total.incrementalValue ?? 0) + child.incrementalValue * weight;
    }
    if (child.cumulativeValue !== null) {
      total.cumulativeValue = (total.cumulativeValue ?? 0) + child.cumulativeValue * weight;
    }
    totals.set(key, total);
  }
  for (const total of totals.values()) points.set(seriesKey(total), total);
}

/**
 * Rebuild every aggregate curve from its detailed rows using the controlled
 * Taurus weights. The operation is idempotent, so it also repairs progress
 * series that were published by an earlier portal release.
 */
export function applyProgressWeights(source: ProgressSeriesPoint[]) {
  const points = new Map(source.map((point) => [seriesKey(point), { ...point }]));
  replaceWeightedTotal(points, "monthly", "Engineering");
  replaceWeightedTotal(points, "monthly", "Procurement");
  replaceWeightedTotal(points, "monthly", "Construction");
  replaceWeightedTotal(points, "weekly", "Engineering");
  replaceWeightedTotal(points, "weekly", "Construction");
  replaceWeightedOverall(points);
  return [...points.values()].sort((a, b) => {
    const dateOrder = a.periodDate.localeCompare(b.periodDate);
    if (dateOrder) return dateOrder;
    if (a.frequency !== b.frequency) return a.frequency === "monthly" ? -1 : 1;
    const disciplineOrder = progressOrder(a.discipline, DISCIPLINE_ORDER) - progressOrder(b.discipline, DISCIPLINE_ORDER);
    if (disciplineOrder) return disciplineOrder;
    if (a.subdiscipline === null || b.subdiscipline === null) {
      if (a.subdiscipline === null && b.subdiscipline !== null) return -1;
      if (a.subdiscipline !== null && b.subdiscipline === null) return 1;
    }
    const preferred = a.frequency === "weekly"
      ? WEEKLY_SUBDISCIPLINES[a.discipline] ?? []
      : MONTHLY_SUBDISCIPLINES[a.discipline] ?? [];
    const subdisciplineOrder = progressOrder(a.subdiscipline ?? "", preferred) - progressOrder(b.subdiscipline ?? "", preferred);
    if (subdisciplineOrder) return subdisciplineOrder;
    const measureOrder = ["baseline", "planned", "actual", "forecast"];
    return measureOrder.indexOf(a.measure) - measureOrder.indexOf(b.measure);
  });
}

function utcTime(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

export function projectWeekNumber(date: string) {
  const difference = utcTime(date) - utcTime(PROJECT_WEEK_START_DATE);
  return PROJECT_WEEK_START_NUMBER + Math.round(difference / (7 * DAY_MS));
}

export function projectWeekLabel(date: string) {
  return `Week ${projectWeekNumber(date)}`;
}

export function yearlyCurve(points: CurvePoint[]) {
  const byYear = new Map<string, CurvePoint[]>();
  for (const point of points) {
    const pointYear = point.date.slice(0, 4);
    byYear.set(pointYear, [...(byYear.get(pointYear) ?? []), point]);
  }
  return [...byYear.entries()].map(([pointYear, yearPoints]) => {
    const selected = yearPoints.at(-1)!;
    const latestActual = [...yearPoints].reverse().find((point) => point.actual !== null);
    return {
      date: `${pointYear}-12-31`,
      baseline: selected.baseline,
      planned: selected.planned,
      actual: latestActual?.actual ?? null
    };
  });
}

function addProjectWeekPlaceholders(points: CurvePoint[], year: string) {
  if (!points.length || (year !== "all" && year !== PROJECT_WEEK_START_DATE.slice(0, 4))) return points;
  const first = utcTime(points[0].date);
  const start = utcTime(PROJECT_WEEK_START_DATE);
  if (!Number.isFinite(first) || first <= start) return points;

  const leading: CurvePoint[] = [];
  for (let time = start; time < first; time += 7 * DAY_MS) {
    leading.push({
      date: new Date(time).toISOString().slice(0, 10),
      baseline: null,
      planned: null,
      actual: null
    });
  }
  return [...leading, ...points];
}

export function makeProgressCurve(
  points: ProgressSeriesPoint[],
  grain: ProgressGrain,
  year: string
): CurvePoint[] {
  const source = grain === "weekly" ? "weekly" : "monthly";
  const filtered = points
    .filter((point) => point.frequency === source)
    .filter((point) => year === "all" || point.periodDate.startsWith(`${year}-`));
  const byDate = new Map<string, CurvePoint>();
  for (const point of filtered) {
    const entry = byDate.get(point.periodDate) ?? {
      date: point.periodDate,
      baseline: null,
      planned: null,
      actual: null
    };
    if (point.measure === "baseline" || point.measure === "planned" || point.measure === "actual") {
      const value = point.cumulativeValue ?? point.incrementalValue;
      if (value !== null) entry[point.measure] = value;
    }
    byDate.set(point.periodDate, entry);
  }
  const dated = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (grain === "year") return yearlyCurve(dated);
  if (grain === "weekly") return addProjectWeekPlaceholders(dated, year);
  return dated;
}

export function evaluateProgress(points: CurvePoint[]) {
  const reached = [...points].reverse().find((point) => point.actual !== null) ?? null;
  const planned = reached?.planned ?? reached?.baseline ?? null;
  return {
    date: reached?.date ?? null,
    actual: reached?.actual ?? null,
    planned,
    spi: reached?.actual !== null && reached?.actual !== undefined && planned ? reached.actual / planned : null,
    sv: reached?.actual !== null && reached?.actual !== undefined && planned !== null ? reached.actual - planned : null,
    planSource: reached?.planned !== null && reached?.planned !== undefined
      ? "Current plan"
      : reached?.baseline !== null && reached?.baseline !== undefined
        ? "Baseline"
        : "No plan"
  };
}

export function progressPeriodLabel(date: string, grain: ProgressGrain) {
  if (grain === "year") return date.slice(0, 4);
  const formatted = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: grain === "weekly" ? "2-digit" : undefined,
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
  return grain === "weekly" ? `${projectWeekLabel(date)} · ${formatted}` : formatted;
}
