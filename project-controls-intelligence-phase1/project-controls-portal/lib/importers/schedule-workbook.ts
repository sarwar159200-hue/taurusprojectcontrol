import type { Workbook } from "exceljs";
import type { WorkbookPreview } from "../types";
import {
  dateOf,
  headerSet,
  increment,
  normalize,
  sheetStats,
  textOf
} from "./workbook-utils";

export function importScheduleWorkbook(
  workbook: Workbook,
  fileName: string,
  fileSize: number
): WorkbookPreview {
  const sheet = workbook.worksheets[0];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!sheet) {
    errors.push("The workbook contains no worksheets.");
    return {
      kind: "schedule",
      fileName,
      fileSize,
      valid: false,
      title: "Schedule Workbook",
      summary: {},
      sheets: [],
      warnings,
      errors
    };
  }

  const headers = headerSet(sheet);
  ["activity id", "activity name", "activity status", "finish", "total float"].forEach(
    (header) => {
      if (!headers.has(header)) errors.push(`Required schedule column ‘${header}’ was not found.`);
    }
  );

  const statuses: Record<string, number> = {};
  const activityTypes: Record<string, number> = {};
  const dataDates: Record<string, number> = {};
  let activities = 0;
  let summaryRows = 0;
  let critical = 0;
  let wbsErrors = 0;
  let disciplineErrors = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const activityName = textOf(row.getCell(2));
    if (!activityName) {
      if (textOf(row.getCell(1))) summaryRows += 1;
      continue;
    }

    activities += 1;
    increment(statuses, textOf(row.getCell(3)) || "Unspecified");
    increment(activityTypes, textOf(row.getCell(13)) || "Unspecified");
    if (normalize(textOf(row.getCell(12))) === "yes") critical += 1;
    if (textOf(row.getCell(16)) === "#N/A") wbsErrors += 1;
    if (textOf(row.getCell(17)) === "#N/A") disciplineErrors += 1;
    const dataDate = dateOf(row.getCell(15));
    if (dataDate) increment(dataDates, dataDate);
  }

  if (activities === 0) errors.push("No activity rows with an Activity Name were found.");

  const logicFields = [
    "predecessors",
    "successors",
    "calendar",
    "primary constraint",
    "constraint date",
    "resource names"
  ];
  const missingLogic = logicFields.filter((field) => !headers.has(field));
  if (missingLogic.length) {
    warnings.push(
      `This Excel export cannot reproduce full P6 logic because it is missing: ${missingLogic.join(", ")}. Use XER in Phase 2.`
    );
  }
  if (wbsErrors) warnings.push(`${wbsErrors} activity rows contain #N/A in P-WBS.`);
  if (disciplineErrors) warnings.push(`${disciplineErrors} activity rows contain #N/A in P-Diciplines.`);

  const dataDate = Object.entries(dataDates).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const projectTitle = textOf(sheet.getRow(2).getCell(1)).trim() || "Imported P6 Schedule";

  return {
    kind: "schedule",
    fileName,
    fileSize,
    valid: errors.length === 0,
    title: projectTitle,
    summary: {
      rows: Math.max(sheet.rowCount - 1, 0),
      activities,
      summaryRows,
      critical,
      dataDate,
      wbsErrors,
      disciplineErrors
    },
    sheets: sheetStats(workbook),
    warnings,
    errors,
    distributions: { statuses, activityTypes }
  };
}
