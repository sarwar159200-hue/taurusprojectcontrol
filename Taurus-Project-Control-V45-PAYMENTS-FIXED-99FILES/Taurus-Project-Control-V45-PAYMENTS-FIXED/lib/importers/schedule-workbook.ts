import type { Workbook } from "exceljs";
import type { ScheduleActivityInput, WorkbookAnalysis } from "../types";
import {
  dateOf,
  headerColumns,
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

  const headers = headerColumns(sheet);
  const requiredColumns = [
    { label: "Activity ID", names: ["activity id"] },
    { label: "Activity Name", names: ["activity name"] },
    { label: "Activity Status", names: ["activity status"] },
    { label: "BL Project Start", names: ["bl project start", "baseline start"] },
    { label: "Start", names: ["start", "current start"] },
    { label: "BL Project Finish", names: ["bl project finish", "baseline finish"] },
    { label: "Finish", names: ["finish", "current finish"] },
    { label: "Total Float", names: ["total float"] },
    { label: "Data Date", names: ["data date", "data date (dd-mmm-yyyy)"] }
  ];
  requiredColumns.forEach(({ label, names }) => {
    if (!names.some((name) => headers.has(name))) errors.push(`Required schedule column ‘${label}’ was not found.`);
  });

  const column = (...names: string[]) => names.map((name) => headers.get(name)).find(Boolean) ?? 0;
  const columns = {
    activityId: column("activity id"),
    activityName: column("activity name"),
    activityStatus: column("activity status"),
    baselineStart: column("bl project start", "baseline start"),
    currentStart: column("start", "current start"),
    baselineFinish: column("bl project finish", "baseline finish"),
    currentFinish: column("finish", "current finish"),
    remainingDuration: column("remaining duration"),
    totalFloat: column("total float"),
    schedulePercent: column("schedule % complete", "schedule percent complete"),
    performancePercent: column("performance % complete", "performance percent complete"),
    critical: column("critical"),
    activityType: column("activity type"),
    originalDuration: column("original duration"),
    dataDate: column("data date", "data date (dd-mmm-yyyy)"),
    discipline: column("p-wbs", "discipline"),
    subdiscipline: column("p-diciplines", "p-disciplines", "sub-discipline", "subdiscipline")
  };

  if (errors.length) {
    return {
      kind: "schedule",
      fileName,
      fileSize,
      valid: false,
      title: "Schedule Workbook",
      summary: { rows: Math.max(sheet.rowCount - 1, 0) },
      sheets: sheetStats(workbook),
      warnings,
      errors
    };
  }

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
    const activityName = columns.activityName ? textOf(row.getCell(columns.activityName)) : "";
    if (!activityName) {
      if (columns.activityId && textOf(row.getCell(columns.activityId))) summaryRows += 1;
      continue;
    }

    activities += 1;
    const activityStatus = textOf(row.getCell(columns.activityStatus)) || "Unspecified";
    const activityType = columns.activityType ? textOf(row.getCell(columns.activityType)) || "Unspecified" : "Unspecified";
    const isCritical = columns.critical ? normalize(textOf(row.getCell(columns.critical))) === "yes" : false;
    increment(statuses, activityStatus);
    increment(activityTypes, activityType);
    if (isCritical) critical += 1;
    if (columns.discipline && textOf(row.getCell(columns.discipline)) === "#N/A") wbsErrors += 1;
    if (columns.subdiscipline && textOf(row.getCell(columns.subdiscipline)) === "#N/A") disciplineErrors += 1;
    const dataDate = columns.dataDate ? dateOf(row.getCell(columns.dataDate)) : null;
    if (dataDate) increment(dataDates, dataDate);

    const disciplineValue = columns.discipline ? textOf(row.getCell(columns.discipline)) : "";
    const subdisciplineValue = columns.subdiscipline ? textOf(row.getCell(columns.subdiscipline)) : "";

    scheduleActivities.push({
      activityId: textOf(row.getCell(columns.activityId)),
      activityName,
      wbsPath: [disciplineValue, subdisciplineValue]
        .filter((value) => value && value !== "#N/A")
        .join(" / "),
      discipline: disciplineValue && disciplineValue !== "#N/A"
        ? disciplineValue
        : "Unassigned",
      subdiscipline: subdisciplineValue && subdisciplineValue !== "#N/A"
        ? subdisciplineValue
        : "Unassigned",
      activityStatus,
      activityType,
      baselineStart: columns.baselineStart ? dateOf(row.getCell(columns.baselineStart)) : null,
      baselineFinish: columns.baselineFinish ? dateOf(row.getCell(columns.baselineFinish)) : null,
      currentStart: columns.currentStart ? dateOf(row.getCell(columns.currentStart)) : null,
      currentFinish: columns.currentFinish ? dateOf(row.getCell(columns.currentFinish)) : null,
      originalDuration: columns.originalDuration ? numberOf(row.getCell(columns.originalDuration)) : null,
      remainingDuration: columns.remainingDuration ? numberOf(row.getCell(columns.remainingDuration)) : null,
      totalFloat: columns.totalFloat ? numberOf(row.getCell(columns.totalFloat)) : null,
      schedulePercentComplete: columns.schedulePercent ? numberOf(row.getCell(columns.schedulePercent)) : null,
      performancePercentComplete: columns.performancePercent ? numberOf(row.getCell(columns.performancePercent)) : null,
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
  if (!dataDate) errors.push("No valid project Data Date was found in the schedule activity rows.");
  if (Object.keys(dataDates).length > 1) {
    warnings.push(`The schedule contains ${Object.keys(dataDates).length} different Data Dates. The most frequent activity Data Date (${dataDate}) was used.`);
  }
  const projectTitle = columns.activityId ? textOf(sheet.getRow(2).getCell(columns.activityId)).trim() : "";
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
    title: projectTitle || "Imported P6 Schedule",
    summary: {
      rows: Math.max(sheet.rowCount - 1, 0),
      activities,
      summaryRows,
      critical,
      dataDate,
      dataDateSource: "Project Schedule / Data Date",
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
