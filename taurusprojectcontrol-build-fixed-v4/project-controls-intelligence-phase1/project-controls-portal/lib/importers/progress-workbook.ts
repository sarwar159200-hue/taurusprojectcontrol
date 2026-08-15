import type { Workbook, Worksheet } from "exceljs";
import type {
  CurvePoint,
  DocumentRecordInput,
  ProgressSeriesPoint,
  WorkbookAnalysis
} from "../types";
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

function curveByRows(
  sheet: Worksheet,
  dateRow: number,
  valueRow: number
): Map<string, number> {
  const points = new Map<string, number>();
  for (let column = 2; column <= sheet.columnCount; column += 1) {
    const date = dateOf(sheet.getRow(dateRow).getCell(column));
    const value = numberOf(sheet.getRow(valueRow).getCell(column));
    if (date && value !== null) points.set(date, value);
  }
  return points;
}

function readOverallCurve(sheet: Worksheet): CurvePoint[] {
  const baseline = curveByRows(sheet, 1, 8);
  const planned = curveByRows(sheet, 10, 17);
  const actual = curveByRows(sheet, 19, 26);
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

function areaForSheet(sheetName: string) {
  const name = normalize(sheetName);
  if (name.includes("engineering")) return "Engineering";
  if (name.includes("procurement")) return "Procurement";
  if (name.includes("construction")) return "Construction";
  return "Overall";
}

function measureFromLabel(label: string): ProgressSeriesPoint["measure"] | null {
  const normalized = normalize(label);
  if (normalized.includes("baseline")) return "baseline";
  if (normalized.includes("planned")) return "planned";
  if (normalized.includes("actual")) return "actual";
  if (normalized.includes("forecast")) return "forecast";
  return null;
}

function disciplineFromLabel(label: string) {
  const cleaned = label
    .replace(/baseline|planned|actual|forecast/gi, "")
    .replace(/cumulative|monthly|weekly|progress/gi, "")
    .replace(/date/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Overall";
}

function readProgressSeries(workbook: Workbook, actualCutoff: string | null) {
  const points = new Map<string, ProgressSeriesPoint>();
  for (const sheet of workbook.worksheets) {
    if (normalize(sheet.name) === "mdr") continue;
    const frequency: ProgressSeriesPoint["frequency"] = normalize(sheet.name).includes("weekly")
      ? "weekly"
      : "monthly";
    const area = areaForSheet(sheet.name);
    let currentMeasure: ProgressSeriesPoint["measure"] | null = null;
    let dates: Array<string | null> = [];

    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const label = textOf(row.getCell(1));
      if (!label) continue;
      const measure = measureFromLabel(label);
      if (normalize(label).includes("date") && measure) {
        currentMeasure = measure;
        dates = [];
        for (let column = 2; column <= sheet.columnCount; column += 1) {
          dates.push(dateOf(row.getCell(column)));
        }
        continue;
      }
      if (!currentMeasure || !measure || measure !== currentMeasure || dates.length === 0) continue;

      const isCumulative = normalize(label).includes("cumulative");
      const discipline = disciplineFromLabel(label);
      const activeMeasure: ProgressSeriesPoint["measure"] = currentMeasure;
      let running = 0;
      dates.forEach((periodDate, index) => {
        if (!periodDate) return;
        if (activeMeasure === "actual" && actualCutoff && periodDate > actualCutoff) return;
        const value = numberOf(row.getCell(index + 2));
        if (value === null) return;
        const key = [frequency, area, discipline, activeMeasure, periodDate].join("|");
        const existing = points.get(key) ?? {
          frequency,
          area,
          discipline,
          subdiscipline: null,
          measure: activeMeasure,
          periodDate,
          incrementalValue: null,
          cumulativeValue: null
        };
        if (isCumulative) {
          existing.cumulativeValue = value;
        } else {
          running += value;
          existing.incrementalValue = value;
          if (existing.cumulativeValue === null) existing.cumulativeValue = running;
        }
        points.set(key, existing);
      });
    }
  }
  return Array.from(points.values()).sort((a, b) => a.periodDate.localeCompare(b.periodDate));
}

function calculateTrendFinish(chart: CurvePoint[]) {
  const actual = chart.filter((point) => point.actual !== null && (point.actual ?? 0) > 0);
  if (actual.length < 2) return null;
  const first = actual[0];
  const latest = actual.at(-1)!;
  const elapsedDays = Math.max(
    1,
    Math.round((Date.parse(`${latest.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / 86400000)
  );
  const earned = (latest.actual ?? 0) - (first.actual ?? 0);
  if (earned <= 0 || (latest.actual ?? 0) >= 1) return null;
  const remainingDays = Math.ceil((1 - (latest.actual ?? 0)) / (earned / elapsedDays));
  const finish = new Date(Date.parse(`${latest.date}T00:00:00Z`) + remainingDays * 86400000);
  return finish.toISOString().slice(0, 10);
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

      documentsByNumber.set(documentNo, {
        documentNo,
        title: textOf(row.getCell(7)),
        systemDivision: textOf(row.getCell(2)),
        documentType: textOf(row.getCell(3)),
        discipline,
        subdiscipline: textOf(row.getCell(2)),
        revision: textOf(row.getCell(9)) || textOf(row.getCell(33)),
        purpose: textOf(row.getCell(21)),
        lastSubmissionDate: dateOf(row.getCell(20)),
        lastResponseDate: dateOf(row.getCell(22)),
        lastStatus: status,
        currentAction: action,
        reviewCycles: numberOf(row.getCell(25)),
        overdueDays: numberOf(row.getCell(10)) ?? numberOf(row.getCell(27)),
        driveWebUrl: textOf(row.getCell(4)) || null,
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

  const chart = overall ? readOverallCurve(overall) : [];
  const actualPoints = chart.filter((point) => point.actual !== null);
  const latest = actualPoints.at(-1) ?? null;
  const actual = latest?.actual ?? null;
  const planned = latest?.planned ?? null;
  const baseline = latest?.baseline ?? null;
  const spi = actual !== null && planned ? actual / planned : null;
  const sv = actual !== null && planned !== null ? actual - planned : null;
  const trendFinish = calculateTrendFinish(chart);
  const progressSeries = readProgressSeries(workbook, latest?.date ?? null);

  const expectedSheets = [
    "Monthly Discipline Engineering",
    "Construction Monthly",
    "Monthly Procurement",
    "Construction Weekly",
    "Engineering Weekly"
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
      dataDate: latest?.date ?? null,
      baseline: baseline === null ? null : Number((baseline * 100).toFixed(2)),
      planned: planned === null ? null : Number((planned * 100).toFixed(2)),
      actual: actual === null ? null : Number((actual * 100).toFixed(2)),
      spi: spi === null ? null : Number(spi.toFixed(3)),
      sv: sv === null ? null : Number((sv * 100).toFixed(2)),
      trendFinish,
      scheduleStatus:
        spi === null ? "No current plan" : spi > 1.01 ? "Ahead of schedule" : spi >= 0.99 ? "On schedule" : spi >= 0.96 ? "Slightly behind" : "Delayed"
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
