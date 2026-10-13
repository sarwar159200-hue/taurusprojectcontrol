import type { Workbook } from "exceljs";
import type { ScheduleActivityInput, WorkbookAnalysis } from "../types";
import {
  dateOf,
  headerColumns,
  increment,
  normalize,
  numberOf,
  sheetStats,
  textOf,
  validISO
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

  // A version has a unique (version_id, activity_id) constraint.
  // Do not silently discard conflicting P6 activities: require the source to be fixed.
  const seen = new Map<string, ScheduleActivityInput>();
  const unique: ScheduleActivityInput[] = [];
  let repeated = 0;
  for (const item of scheduleActivities) {
    const id = item.activityId.trim();
    if (!id) { errors.push(`Activity at Excel row ${item.sourceRow} has no Activity ID.`); continue; }
    const previous = seen.get(id);
    if (!previous) { seen.set(id, item); unique.push(item); continue; }
    const { sourceRow: _a, ...first } = previous;
    const { sourceRow: _b, ...second } = item;
    if (JSON.stringify(first) === JSON.stringify(second)) { repeated++; continue; }
    errors.push(`Duplicate Activity ID ${id} at rows ${previous.sourceRow} and ${item.sourceRow} has conflicting data. Correct the source before publishing.`);
  }
  if (repeated) warnings.push(`${repeated} identical repeated activity rows were removed.`);
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
    scheduleActivities: unique
  };
}



function iso(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? validISO(match[1]) : null;
}
function num(value: string | undefined): number | null {
  const n = Number(value);
  return value?.trim() && Number.isFinite(n) ? n : null;
}
export function importXer(text: string, fileName: string, fileSize: number): WorkbookAnalysis {
  const tables = new Map<string, Record<string, string>[]>();
  let table = ""; let fields: string[] = [];
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const parts = line.split("\t");
    if (parts[0] === "%T") { table = parts[1]; fields = []; if (!tables.has(table)) tables.set(table, []); }
    else if (parts[0] === "%F") fields = parts.slice(1);
    else if (parts[0] === "%R" && fields.length) {
      const row: Record<string,string> = {};
      fields.forEach((field, i) => row[field] = parts[i + 1] ?? "");
      tables.get(table)?.push(row);
    }
  }
  const tasks = tables.get("TASK") ?? [];
  const nodes = new Map((tables.get("PROJWBS") ?? []).map(row => [row.wbs_id, row]));
  const projects = tables.get("PROJECT") ?? [];
  const project = projects[0];
  const dataDate = iso(project?.last_schedule_date) ?? iso(project?.apply_actuals_date);
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!tasks.length) errors.push("The XER contains no TASK activities.");
  if (!dataDate) errors.push("The XER has no valid PROJECT last_schedule_date (P6 Data Date).");
  const seen = new Map<string, number>();
  const statuses: Record<string,number> = {};
  const activityTypes: Record<string,number> = {};
  let critical = 0;
  const scheduleActivities: ScheduleActivityInput[] = [];
  tasks.forEach((task, index) => {
    const id = (task.task_code ?? "").trim();
    if (!id) { errors.push(`XER TASK row ${index + 1} has no task_code.`); return; }
    if (seen.has(id)) { errors.push(`Duplicate P6 Activity ID ${id} at TASK rows ${seen.get(id)} and ${index + 1}.`); return; }
    seen.set(id, index + 1);
    const path: string[] = [];
    const visited = new Set<string>();
    let wbsId = task.wbs_id;
    while (wbsId && nodes.has(wbsId) && !visited.has(wbsId)) {
      visited.add(wbsId);
      const node = nodes.get(wbsId)!;
      path.unshift(node.wbs_name || node.wbs_short_name || wbsId);
      wbsId = node.parent_wbs_id;
    }
    const status = task.status_code === "TK_Complete" ? "Completed" : task.status_code === "TK_Active" ? "In Progress" : task.status_code === "TK_NotStart" ? "Not Started" : task.status_code || "Unspecified";
    const type = task.task_type || "Unspecified";
    statuses[status] = (statuses[status] || 0) + 1;
    activityTypes[type] = (activityTypes[type] || 0) + 1;
    const totalFloat = num(task.total_float_hr_cnt);
    const isCritical = totalFloat !== null && totalFloat <= 0;
    if (isCritical) critical++;
    // P6 XER WBS is hierarchical, unlike the custom Excel P-WBS/P-Diciplines columns.
    // Preserve the full hierarchy; derive group labels from the same top-down hierarchy.
    const discipline = path[1] || path[0] || "Unassigned";
    const subdiscipline = path[2] || path[1] || "Unassigned";
    const original = num(task.target_drtn_hr_cnt);
    const remaining = num(task.remain_drtn_hr_cnt);
    scheduleActivities.push({
      activityId: id, activityName: task.task_name || id, wbsPath: path.join(" / "),
      discipline, subdiscipline, activityStatus: status, activityType: type,
      baselineStart: iso(task.target_start_date), baselineFinish: iso(task.target_end_date),
      currentStart: iso(task.act_start_date) ?? iso(task.early_start_date) ?? iso(task.target_start_date),
      currentFinish: iso(task.act_end_date) ?? iso(task.early_end_date) ?? iso(task.target_end_date),
      originalDuration: original === null ? null : original / 8,
      remainingDuration: remaining === null ? null : remaining / 8,
      totalFloat: totalFloat === null ? null : totalFloat / 8,
      schedulePercentComplete: num(task.phys_complete_pct),
      performancePercentComplete: num(task.phys_complete_pct),
      isCritical, sourceRow: index + 1
    });
  });
  warnings.push("XER WBS groups are derived from the P6 hierarchy. Verify discipline mapping against the controlled Excel P-WBS/P-Diciplines columns before publishing; XER does not contain those Excel-specific classifications.");
  warnings.push("P6 hour-based durations and float are displayed as approximate 8-hour days; calendar-specific conversions require additional calendar processing.");
  const forecastFinish = scheduleActivities.map(a => a.currentFinish).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  return { kind: "schedule", fileName, fileSize, valid: errors.length === 0,
    title: project?.proj_short_name || "P6 XER Schedule", summary: { rows: tasks.length, activities: scheduleActivities.length, critical, dataDate, dataDateSource: "P6 PROJECT / last_schedule_date", forecastFinish, wbsErrors: 0, disciplineErrors: 0 },
    sheets: [{name:"P6 TASK",rows:tasks.length,columns:0}], warnings, errors,
    distributions: { statuses, activityTypes }, scheduleActivities };
}
