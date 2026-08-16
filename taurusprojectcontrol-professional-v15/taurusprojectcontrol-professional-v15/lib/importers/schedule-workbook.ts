import type { Workbook } from "exceljs";
import type { ScheduleActivityInput, WorkbookAnalysis } from "../types";
import {
  dateOf,
  headerSet,
  increment,
  normalize,
  numberOf,
  sheetStats,
  textOf
} from "./workbook-utils";

export function importScheduleWorkbook(
  workbook: Workbook,
  fileName: string,
  fileSize: number
): WorkbookAnalysis {
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
  const scheduleActivities: ScheduleActivityInput[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const activityName = textOf(row.getCell(2));
    if (!activityName) {
      if (textOf(row.getCell(1))) summaryRows += 1;
      continue;
    }

    activities += 1;
    const activityStatus = textOf(row.getCell(3)) || "Unspecified";
    const activityType = textOf(row.getCell(13)) || "Unspecified";
    const isCritical = normalize(textOf(row.getCell(12))) === "yes";
    increment(statuses, activityStatus);
    increment(activityTypes, activityType);
    if (isCritical) critical += 1;
    if (textOf(row.getCell(16)) === "#N/A") wbsErrors += 1;
    if (textOf(row.getCell(17)) === "#N/A") disciplineErrors += 1;
    const dataDate = dateOf(row.getCell(15));
    if (dataDate) increment(dataDates, dataDate);

    scheduleActivities.push({
      activityId: textOf(row.getCell(1)),
      activityName,
      wbsPath: [textOf(row.getCell(16)), textOf(row.getCell(17))]
        .filter((value) => value && value !== "#N/A")
        .join(" / "),
      discipline: textOf(row.getCell(16)) && textOf(row.getCell(16)) !== "#N/A"
        ? textOf(row.getCell(16))
        : "Unassigned",
      subdiscipline: textOf(row.getCell(17)) && textOf(row.getCell(17)) !== "#N/A"
        ? textOf(row.getCell(17))
        : "Unassigned",
      activityStatus,
      activityType,
      baselineStart: dateOf(row.getCell(4)),
      baselineFinish: dateOf(row.getCell(6)),
      currentStart: dateOf(row.getCell(5)),
      currentFinish: dateOf(row.getCell(7)),
      originalDuration: numberOf(row.getCell(14)),
      remainingDuration: numberOf(row.getCell(8)),
      totalFloat: numberOf(row.getCell(9)),
      schedulePercentComplete: numberOf(row.getCell(10)),
      performancePercentComplete: numberOf(row.getCell(11)),
      isCritical,
      sourceRow: rowNumber
    });
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
  const forecastFinish = scheduleActivities
    .map((activity) => activity.currentFinish)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

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
      forecastFinish,
      wbsErrors,
      disciplineErrors
    },
    sheets: sheetStats(workbook),
    warnings,
    errors,
    distributions: { statuses, activityTypes },
    scheduleActivities
  };
}
