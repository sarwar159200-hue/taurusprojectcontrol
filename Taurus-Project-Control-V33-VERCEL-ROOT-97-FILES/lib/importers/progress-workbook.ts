import type { Workbook, Worksheet } from "exceljs";
import type {
  CurvePoint,
  DocumentRecordInput,
  ProgressSeriesPoint,
  WorkbookAnalysis
} from "../types";
import {
  canonicalSubdiscipline
} from "../progress-structure";
import { progressPerformance, signalLabel } from "../progress-metrics";
import {
  dateOf,
  increment,
  normalize,
  numberOf,
  sheetStats,
  textOf
} from "./workbook-utils";

function findSheet(workbook: Workbook, name: string) {
  return workbook.worksheets.find(
    (sheet) => normalize(sheet.name) === normalize(name)
  );
}

function validMdrDate(value: string | null) {
  if (!value || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function addCalendarDays(value: string | null, days: number) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calendarDaysBetween(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const finish = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) return null;
  return Math.floor((finish - start) / 86_400_000);
}

function workflowResponsibility(action: string) {
  const value = normalize(action);
  if (value.includes("taurus")) return "Taurus";
  if (value.includes("enka")) return "ENKA";
  if (value.includes("hold")) return "On Hold";
  if (value.includes("final")) return "Closed";
  return "Unassigned";
}

function curveByRows(
  sheet: Worksheet,
  dateRow: number,
  valueRow: number,
  cutoff: string | null = null
): Map<string, number> {
  const points = new Map<string, number>();
  for (let column = 2; column <= sheet.columnCount; column += 1) {
    const date = dateOf(sheet.getRow(dateRow).getCell(column));
    const value = numberOf(sheet.getRow(valueRow).getCell(column));
    if (date && value !== null && (!cutoff || date <= cutoff)) points.set(date, value);
  }
  return points;
}

function lastActualDate(sheet: Worksheet, dateRow: number, incrementalRow: number) {
  let last: string | null = null;
  for (let column = 2; column <= sheet.columnCount; column += 1) {
    const date = dateOf(sheet.getRow(dateRow).getCell(column));
    const value = numberOf(sheet.getRow(incrementalRow).getCell(column));
    if (date && value !== null && Math.abs(value) > 0.000000000001) last = date;
  }
  return last;
}

function readOverallCurve(sheet: Worksheet, actualCutoff: string | null): CurvePoint[] {
  const baseline = curveByRows(sheet, 1, 8);
  const planned = curveByRows(sheet, 10, 17);
  const actual = curveByRows(sheet, 19, 26, actualCutoff);
  const dates = Array.from(
    new Set([...baseline.keys(), ...planned.keys(), ...actual.keys()])
  ).sort();

  return dates.map((date) => ({
    date,
    baseline: baseline.get(date) ?? null,
    planned: planned.get(date) ?? null,
    actual: actual.get(date) ?? null
  }));
}

type ControlledMeasure = "baseline" | "actual";

type ProgressBlock = {
  dateRow: number;
  itemStartRow: number;
  itemEndRow: number;
  totalIncrementRow: number;
  totalCumulativeRow: number;
  labelColumn?: number;
  firstPeriodColumn?: number;
};

function setProgressPoint(
  points: Map<string, ProgressSeriesPoint>,
  input: ProgressSeriesPoint
) {
  const key = [input.frequency, input.discipline, input.subdiscipline ?? "", input.measure, input.periodDate].join("|");
  points.set(key, input);
}

function datesFromRow(sheet: Worksheet, rowNumber: number, firstColumn = 2) {
  const dates: Array<{ column: number; date: string }> = [];
  for (let column = firstColumn; column <= sheet.columnCount; column += 1) {
    const date = dateOf(sheet.getRow(rowNumber).getCell(column));
    if (date && /^20\d{2}-\d{2}-\d{2}$/.test(date)) dates.push({ column, date });
  }
  return dates;
}

function lastNonZeroDate(
  sheet: Worksheet,
  dateRow: number,
  valueRow: number,
  firstColumn = 2
) {
  let last: string | null = null;
  for (const period of datesFromRow(sheet, dateRow, firstColumn)) {
    const value = numberOf(sheet.getRow(valueRow).getCell(period.column));
    if (value !== null && Math.abs(value) > 0.000000000001) last = period.date;
  }
  return last;
}

function latestCumulativeBefore(
  points: Map<string, ProgressSeriesPoint>,
  frequency: ProgressSeriesPoint["frequency"],
  discipline: string,
  subdiscipline: string,
  measure: ControlledMeasure,
  beforeDate: string
) {
  return Array.from(points.values())
    .filter((point) => point.frequency === frequency)
    .filter((point) => point.discipline === discipline && point.subdiscipline === subdiscipline)
    .filter((point) => point.measure === measure && point.periodDate < beforeDate)
    .sort((a, b) => a.periodDate.localeCompare(b.periodDate))
    .at(-1)?.cumulativeValue ?? 0;
}

function progressItemLabel(value: string) {
  return canonicalSubdiscipline(
    value
      .replace(/^\s*(?:baseline|planned|plan|actual|forecast)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function readStandardBlock(
  sheet: Worksheet,
  points: Map<string, ProgressSeriesPoint>,
  frequency: ProgressSeriesPoint["frequency"],
  discipline: string,
  measure: ControlledMeasure,
  block: ProgressBlock,
  cutoff: string | null,
  seedFrequency: ProgressSeriesPoint["frequency"] | null = null
) {
  const labelColumn = block.labelColumn ?? 1;
  const periods = datesFromRow(sheet, block.dateRow, block.firstPeriodColumn ?? 2)
    .filter((period) => measure !== "actual" || !cutoff || period.date <= cutoff);
  if (!periods.length) return;

  const totalIncrementRow = sheet.getRow(block.totalIncrementRow);
  const totalCumulativeRow = sheet.getRow(block.totalCumulativeRow);
  for (const period of periods) {
    const incrementalValue = numberOf(totalIncrementRow.getCell(period.column));
    const cumulativeValue = numberOf(totalCumulativeRow.getCell(period.column));
    if (incrementalValue === null && cumulativeValue === null) continue;
    setProgressPoint(points, {
      frequency,
      area: discipline,
      discipline,
      subdiscipline: null,
      measure,
      periodDate: period.date,
      incrementalValue,
      cumulativeValue
    });
  }

  for (let rowNumber = block.itemStartRow; rowNumber <= block.itemEndRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const rawLabel = textOf(row.getCell(labelColumn));
    if (!rawLabel) continue;
    const subdiscipline = progressItemLabel(rawLabel);
    let running = seedFrequency
      ? latestCumulativeBefore(points, seedFrequency, discipline, subdiscipline, measure, periods[0].date)
      : 0;
    for (const period of periods) {
      const incrementalValue = numberOf(row.getCell(period.column));
      if (incrementalValue === null) continue;
      running += incrementalValue;
      setProgressPoint(points, {
        frequency,
        area: discipline,
        discipline,
        subdiscipline,
        measure,
        periodDate: period.date,
        incrementalValue,
        cumulativeValue: running
      });
    }
  }
}

function readMobilizationSeries(
  sheet: Worksheet,
  points: Map<string, ProgressSeriesPoint>,
  measure: ControlledMeasure,
  dateRow: number,
  valueRow: number,
  cutoff: string | null
) {
  let running = 0;
  for (const period of datesFromRow(sheet, dateRow)) {
    if (measure === "actual" && cutoff && period.date > cutoff) continue;
    const incrementalValue = numberOf(sheet.getRow(valueRow).getCell(period.column));
    if (incrementalValue === null) continue;
    running += incrementalValue;
    setProgressPoint(points, {
      frequency: "monthly",
      area: "Mobilization",
      discipline: "Mobilization",
      subdiscipline: null,
      measure,
      periodDate: period.date,
      incrementalValue,
      cumulativeValue: running
    });
  }
}

function readOverallSeries(
  sheet: Worksheet,
  points: Map<string, ProgressSeriesPoint>,
  measure: ControlledMeasure,
  dateRow: number,
  incrementalRow: number,
  cumulativeRow: number,
  cutoff: string | null
) {
  for (const period of datesFromRow(sheet, dateRow)) {
    if (measure === "actual" && cutoff && period.date > cutoff) continue;
    const incrementalValue = numberOf(sheet.getRow(incrementalRow).getCell(period.column));
    const cumulativeValue = numberOf(sheet.getRow(cumulativeRow).getCell(period.column));
    if (incrementalValue === null && cumulativeValue === null) continue;
    setProgressPoint(points, {
      frequency: "monthly",
      area: "Overall",
      discipline: "Overall",
      subdiscipline: null,
      measure,
      periodDate: period.date,
      incrementalValue,
      cumulativeValue
    });
  }
}

function specialEngineeringRows(sheet: Worksheet) {
  let baselineHeader = 0;
  let actualHeader = 0;
  let baselineIncrement = 0;
  let baselineCumulative = 0;
  let actualIncrement = 0;
  let actualCumulative = 0;
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const label = normalize(textOf(sheet.getRow(rowNumber).getCell(3)));
    if (label.includes("engineering") && label.includes("baseline")) baselineHeader = rowNumber;
    else if (label.includes("engineering") && label.includes("actual")) actualHeader = rowNumber;
    else if (label.includes("baseline") && label.includes("monthly")) baselineIncrement = rowNumber;
    else if (label.includes("baseline") && label.includes("cumulative")) baselineCumulative = rowNumber;
    else if (label.includes("actual") && label.includes("monthly")) actualIncrement = rowNumber;
    else if (label.includes("actual") && label.includes("cumulative")) actualCumulative = rowNumber;
  }
  return { baselineHeader, actualHeader, baselineIncrement, baselineCumulative, actualIncrement, actualCumulative };
}

function readWeeklyEngineering(
  sheet: Worksheet,
  points: Map<string, ProgressSeriesPoint>
) {
  const rows = specialEngineeringRows(sheet);
  if (!rows.baselineHeader || !rows.actualHeader || !rows.baselineCumulative || !rows.actualCumulative) return;

  const readMeasure = (
    measure: ControlledMeasure,
    headerRow: number,
    itemStartRow: number,
    itemEndRow: number,
    incrementalRow: number,
    cumulativeRow: number,
    cutoff: string | null
  ) => {
    const periods = datesFromRow(sheet, headerRow, 4)
      .filter((period) => measure !== "actual" || !cutoff || period.date <= cutoff);
    for (const period of periods) {
      const incrementalValue = numberOf(sheet.getRow(incrementalRow).getCell(period.column));
      const cumulativeValue = numberOf(sheet.getRow(cumulativeRow).getCell(period.column));
      if (incrementalValue === null && cumulativeValue === null) continue;
      setProgressPoint(points, {
        frequency: "weekly",
        area: "Engineering",
        discipline: "Engineering",
        subdiscipline: null,
        measure,
        periodDate: period.date,
        incrementalValue,
        cumulativeValue
      });
    }

    for (let rowNumber = itemStartRow; rowNumber <= itemEndRow; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const rawLabel = textOf(row.getCell(3));
      if (!rawLabel) continue;
      const subdiscipline = progressItemLabel(rawLabel);
      let running: number | null = null;
      for (const period of periods) {
        const value = numberOf(row.getCell(period.column));
        if (value === null) continue;
        const incrementalValue = running === null ? null : value;
        running = running === null ? value : running + value;
        setProgressPoint(points, {
          frequency: "weekly",
          area: "Engineering",
          discipline: "Engineering",
          subdiscipline,
          measure,
          periodDate: period.date,
          incrementalValue,
          cumulativeValue: running
        });
      }
    }
  };

  const baselineCutoff = null;
  const actualCutoff = lastNonZeroDate(sheet, rows.actualHeader, rows.actualIncrement, 4);
  readMeasure("baseline", rows.baselineHeader, rows.baselineHeader + 1, rows.baselineIncrement - 1, rows.baselineIncrement, rows.baselineCumulative, baselineCutoff);
  readMeasure("actual", rows.actualHeader, rows.actualHeader + 1, rows.actualIncrement - 1, rows.actualIncrement, rows.actualCumulative, actualCutoff);
}

function readProgressSeries(workbook: Workbook, monthlyActualCutoff: string | null) {
  const points = new Map<string, ProgressSeriesPoint>();
  const overall = findSheet(workbook, "Overall Monthly S-Curve");
  const engineering = findSheet(workbook, "Monthly Discipline Engineering");
  const procurement = findSheet(workbook, "Monthly Procurement");
  const construction = findSheet(workbook, "Construction Monthly");
  const weeklyConstruction = findSheet(workbook, "Weekly Construction") ?? findSheet(workbook, "Construction Weekly");
  const weeklyEngineering = findSheet(workbook, "Weekly Engineering") ?? findSheet(workbook, "Engineering Weekly");

  if (overall) {
    readOverallSeries(overall, points, "baseline", 1, 7, 8, null);
    readOverallSeries(overall, points, "actual", 19, 25, 26, monthlyActualCutoff);
    readMobilizationSeries(overall, points, "baseline", 1, 5, null);
    readMobilizationSeries(overall, points, "actual", 19, 23, monthlyActualCutoff);
  }
  if (engineering) {
    readStandardBlock(engineering, points, "monthly", "Engineering", "baseline", { dateRow: 1, itemStartRow: 2, itemEndRow: 7, totalIncrementRow: 8, totalCumulativeRow: 9 }, null);
    readStandardBlock(engineering, points, "monthly", "Engineering", "actual", { dateRow: 19, itemStartRow: 20, itemEndRow: 25, totalIncrementRow: 26, totalCumulativeRow: 27 }, monthlyActualCutoff);
  }
  if (procurement) {
    readStandardBlock(procurement, points, "monthly", "Procurement", "baseline", { dateRow: 1, itemStartRow: 2, itemEndRow: 7, totalIncrementRow: 8, totalCumulativeRow: 9 }, null);
    readStandardBlock(procurement, points, "monthly", "Procurement", "actual", { dateRow: 19, itemStartRow: 20, itemEndRow: 25, totalIncrementRow: 26, totalCumulativeRow: 27 }, monthlyActualCutoff);
  }
  if (construction) {
    readStandardBlock(construction, points, "monthly", "Construction", "baseline", { dateRow: 1, itemStartRow: 2, itemEndRow: 15, totalIncrementRow: 16, totalCumulativeRow: 17 }, null);
    readStandardBlock(construction, points, "monthly", "Construction", "actual", { dateRow: 37, itemStartRow: 38, itemEndRow: 51, totalIncrementRow: 52, totalCumulativeRow: 53 }, monthlyActualCutoff);
  }
  if (weeklyConstruction) {
    const weeklyActualCutoff = lastNonZeroDate(weeklyConstruction, 19, 34);
    readStandardBlock(weeklyConstruction, points, "weekly", "Construction", "baseline", { dateRow: 1, itemStartRow: 2, itemEndRow: 15, totalIncrementRow: 16, totalCumulativeRow: 17 }, null, "monthly");
    readStandardBlock(weeklyConstruction, points, "weekly", "Construction", "actual", { dateRow: 19, itemStartRow: 20, itemEndRow: 33, totalIncrementRow: 34, totalCumulativeRow: 35 }, weeklyActualCutoff, "monthly");
  }
  if (weeklyEngineering) readWeeklyEngineering(weeklyEngineering, points);

  return Array.from(points.values()).sort((a, b) => {
    const dateOrder = a.periodDate.localeCompare(b.periodDate);
    if (dateOrder) return dateOrder;
    return [a.frequency, a.discipline, a.subdiscipline ?? "", a.measure].join("|")
      .localeCompare([b.frequency, b.discipline, b.subdiscipline ?? "", b.measure].join("|"));
  });
}

export function importProgressWorkbook(
  workbook: Workbook,
  fileName: string,
  fileSize: number
): WorkbookAnalysis {
  const mdr = findSheet(workbook, "MDR");
  const overall = findSheet(workbook, "Overall Monthly S-Curve");
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!mdr) errors.push("Required sheet ‘MDR’ was not found.");
  if (!overall) errors.push("Required sheet ‘Overall Monthly S-Curve’ was not found.");

  const disciplines: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const actions: Record<string, number> = {};
  const uniqueDocuments = new Set<string>();
  let approved = 0;
  let approvedWithComments = 0;
  let underReview = 0;
  let reviseResubmit = 0;
  let documentLinks = 0;
  const documentsByNumber = new Map<string, DocumentRecordInput>();

  if (mdr) {
    for (let rowNumber = 2; rowNumber <= mdr.rowCount; rowNumber += 1) {
      const row = mdr.getRow(rowNumber);
      const documentNo = textOf(row.getCell(6));
      if (!documentNo) continue;

      uniqueDocuments.add(documentNo);
      const discipline = textOf(row.getCell(8)) || "Unspecified";
      const status = textOf(row.getCell(23)) || "Unspecified";
      const action = textOf(row.getCell(24)) || "Unspecified";
      increment(disciplines, discipline);
      increment(statuses, status);
      increment(actions, action);
      if (textOf(row.getCell(4))) documentLinks += 1;

      const firstSubmissionDate = validMdrDate(dateOf(row.getCell(16)));
      const lastSubmissionDate = validMdrDate(dateOf(row.getCell(20)));
      const lastResponseDate = validMdrDate(dateOf(row.getCell(22)));
      const responsibleParty = workflowResponsibility(action);
      const dueDate = responsibleParty === "Taurus"
        ? addCalendarDays(lastSubmissionDate, 14)
        : responsibleParty === "ENKA"
          ? addCalendarDays(lastResponseDate, 14)
          : null;
      const today = new Date().toISOString().slice(0, 10);
      const overdueDays = dueDate && dueDate < today ? calendarDaysBetween(dueDate, today) : null;

      documentsByNumber.set(documentNo, {
        documentNo,
        title: textOf(row.getCell(7)),
        systemDivision: textOf(row.getCell(2)),
        documentType: textOf(row.getCell(3)),
        discipline,
        subdiscipline: textOf(row.getCell(2)),
        revision: textOf(row.getCell(9)) || textOf(row.getCell(33)),
        purpose: textOf(row.getCell(21)),
        firstSubmissionDate,
        lastSubmissionDate,
        lastResponseDate,
        lastStatus: status,
        currentAction: action,
        reviewCycles: numberOf(row.getCell(25)),
        reviewCycleDays: calendarDaysBetween(lastSubmissionDate, lastResponseDate),
        dueDate,
        responsibleParty,
        overdueDays,
        totalRunningDays: numberOf(row.getCell(27)),
        holdByTaurusDays: numberOf(row.getCell(28)),
        holdByEnkaDays: numberOf(row.getCell(29)),
        delayAnalysis: textOf(row.getCell(30)),
        transmittalNo: textOf(row.getCell(31)),
        transmittalDate: validMdrDate(dateOf(row.getCell(32))),
        driveWebUrl: textOf(row.getCell(4)) || textOf(row.getCell(5)) || null,
        sourceRow: rowNumber
      });

      const normalizedStatus = normalize(status);
      if (normalizedStatus.startsWith("a-approved")) approved += 1;
      if (normalizedStatus.startsWith("b-approved")) approvedWithComments += 1;
      if (normalizedStatus.includes("awaiting review")) underReview += 1;
      if (normalizedStatus.startsWith("c-revise")) reviseResubmit += 1;
    }
  }

  if (uniqueDocuments.size === 0 && mdr) {
    errors.push("The MDR sheet contains no usable document numbers in column F.");
  }
  if (uniqueDocuments.size > 0 && documentLinks === 0) {
    warnings.push("No source document links were found in MDR column D.");
  }

  const actualCutoff = overall ? lastActualDate(overall, 19, 25) : null;
  const chart = overall ? readOverallCurve(overall, actualCutoff) : [];
  const actualPoints = chart.filter((point) => point.actual !== null && (!actualCutoff || point.date <= actualCutoff));
  const latest = actualPoints.at(-1) ?? null;
  const planned = latest?.planned ?? null;
  const performance = progressPerformance(chart);
  const progressSeries = readProgressSeries(workbook, latest?.date ?? null);
  // Progress Data Date is the greatest real ACTUAL period reached anywhere in
  // the controlled progress workbook. This captures exact weekly actual dates
  // (for example 2026-08-22) instead of being limited to the monthly Overall row.
  const greatestActualDate = progressSeries
    .filter((point) => point.measure === "actual")
    .filter((point) => point.incrementalValue !== null || point.cumulativeValue !== null)
    .map((point) => point.periodDate)
    .filter((date) => /^20\d{2}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1) ?? performance.dataDate;

  const expectedSheets = [
    "Monthly Discipline Engineering",
    "Construction Monthly",
    "Monthly Procurement",
    "Weekly Construction",
    "Weekly Engineering"
  ];
  expectedSheets.forEach((name) => {
    if (!findSheet(workbook, name)) warnings.push(`Optional analysis sheet ‘${name}’ was not found.`);
  });

  warnings.push(
    "Excel formulas are read from their saved results; website KPIs will be recalculated from normalized data during publishing."
  );

  return {
    kind: "progress",
    fileName,
    fileSize,
    valid: errors.length === 0,
    title: "Progress and Document Control Workbook",
    summary: {
      documents: uniqueDocuments.size,
      approved,
      approvedWithComments,
      underReview,
      reviseResubmit,
      documentLinks,
      dataDate: greatestActualDate,
      baseline: performance.baseline === null ? null : Number((performance.baseline * 100).toFixed(2)),
      planned: planned === null ? null : Number((planned * 100).toFixed(2)),
      actual: performance.actual === null ? null : Number((performance.actual * 100).toFixed(2)),
      spi: performance.spi === null ? null : Number(performance.spi.toFixed(2)),
      sv: performance.sv === null ? null : Number((performance.sv * 100).toFixed(2)),
      expectedFinish: performance.expectedFinish,
      trendFinish: performance.expectedFinish,
      baselineFinish: performance.baselineFinish,
      finishVarianceDays: performance.finishVarianceDays,
      scheduleStatus: signalLabel(performance.signal)
    },
    sheets: sheetStats(workbook),
    warnings,
    errors,
    chart,
    distributions: { disciplines, statuses, actions },
    documents: Array.from(documentsByNumber.values()),
    progressSeries
  };
}
