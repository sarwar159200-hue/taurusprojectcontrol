import type { CurvePoint } from "./types";

const DAY_MS = 86_400_000;

export type ScheduleSignal = "ahead" | "on-plan" | "slightly-behind" | "delayed" | "pending";

export type ProgressPerformance = {
  dataDate: string | null;
  actual: number | null;
  baseline: number | null;
  spi: number | null;
  sv: number | null;
  baselineStart: string | null;
  baselineFinish: string | null;
  expectedFinish: string | null;
  finishVarianceDays: number | null;
  signal: ScheduleSignal;
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

function dateValue(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function addDays(date: string, days: number) {
  return new Date(dateValue(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(start: string, finish: string) {
  return Math.round((dateValue(finish) - dateValue(start)) / DAY_MS);
}

/** Cumulative progress is controlled so it cannot move backwards. */
export function controlledCumulativeCurve(points: CurvePoint[]): CurvePoint[] {
  const sorted = [...points]
    .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  let baselineMax: number | null = null;
  let actualMax: number | null = null;

  return sorted.map((point) => {
    if (point.baseline !== null && Number.isFinite(point.baseline)) {
      baselineMax = Math.max(baselineMax ?? 0, clampProgress(point.baseline));
    }
    if (point.actual !== null && Number.isFinite(point.actual)) {
      actualMax = Math.max(actualMax ?? 0, clampProgress(point.actual));
    }
    return {
      date: point.date,
      baseline: baselineMax,
      planned: null,
      actual: point.actual === null ? null : actualMax
    };
  });
}

function baselineAtDate(points: CurvePoint[], date: string) {
  const exact = points.find((point) => point.date === date)?.baseline;
  if (exact !== null && exact !== undefined) return exact;

  const time = dateValue(date);
  const before = [...points].reverse().find((point) => point.baseline !== null && dateValue(point.date) < time);
  const after = points.find((point) => point.baseline !== null && dateValue(point.date) > time);
  if (before?.baseline !== null && before?.baseline !== undefined && after?.baseline !== null && after?.baseline !== undefined) {
    const span = dateValue(after.date) - dateValue(before.date);
    const weight = span ? (time - dateValue(before.date)) / span : 0;
    return before.baseline + (after.baseline - before.baseline) * weight;
  }
  return before?.baseline ?? after?.baseline ?? null;
}

export function scheduleSignal(spi: number | null): ScheduleSignal {
  if (spi === null || !Number.isFinite(spi)) return "pending";
  if (spi > 1.01) return "ahead";
  if (spi >= 0.99) return "on-plan";
  if (spi >= 0.96) return "slightly-behind";
  return "delayed";
}

/**
 * Baseline-only schedule forecast:
 * SPI = actual cumulative / baseline cumulative at the same data date.
 * SV = actual cumulative - baseline cumulative.
 * Expected duration = approved baseline duration / SPI.
 */
export function progressPerformance(source: CurvePoint[]): ProgressPerformance {
  const points = controlledCumulativeCurve(source);
  const latestActual = [...points].reverse().find((point) => point.actual !== null) ?? null;
  const baselinePoints = points.filter((point) => point.baseline !== null);
  const baselineStart = baselinePoints.at(0)?.date ?? null;
  const completedBaseline = baselinePoints.find((point) => (point.baseline ?? 0) >= 0.999);
  const baselineFinish = completedBaseline?.date ?? baselinePoints.at(-1)?.date ?? null;
  const actual = latestActual?.actual ?? null;
  const baseline = latestActual ? baselineAtDate(points, latestActual.date) : null;
  const spi = actual !== null && baseline !== null && baseline > 0 ? actual / baseline : null;
  const sv = actual !== null && baseline !== null ? actual - baseline : null;

  let expectedFinish: string | null = null;
  let finishVarianceDays: number | null = null;
  if (latestActual && actual !== null && actual >= 0.999) {
    expectedFinish = latestActual.date;
  } else if (baselineStart && baselineFinish && spi !== null && spi > 0) {
    const baselineDurationDays = Math.max(1, daysBetween(baselineStart, baselineFinish));
    expectedFinish = addDays(baselineStart, Math.ceil(baselineDurationDays / spi));
  }
  if (expectedFinish && baselineFinish) finishVarianceDays = daysBetween(baselineFinish, expectedFinish);

  return {
    dataDate: latestActual?.date ?? null,
    actual,
    baseline,
    spi,
    sv,
    baselineStart,
    baselineFinish,
    expectedFinish,
    finishVarianceDays,
    signal: scheduleSignal(spi)
  };
}

export function signalLabel(signal: ScheduleSignal) {
  if (signal === "ahead") return "Ahead of baseline";
  if (signal === "on-plan") return "On baseline";
  if (signal === "slightly-behind") return "Slightly behind baseline";
  if (signal === "delayed") return "Behind baseline";
  return "Pending data";
}
