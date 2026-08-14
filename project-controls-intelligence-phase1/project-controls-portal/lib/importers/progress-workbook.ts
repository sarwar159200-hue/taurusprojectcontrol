import type { Workbook, Worksheet } from "exceljs";
import type { CurvePoint, WorkbookPreview } from "../types";
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

export function importProgressWorkbook(
  workbook: Workbook,
  fileName: string,
  fileSize: number
): WorkbookPreview {
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
      sv: sv === null ? null : Number((sv * 100).toFixed(2))
    },
    sheets: sheetStats(workbook),
    warnings,
    errors,
    chart,
    distributions: { disciplines, statuses, actions }
  };
}
