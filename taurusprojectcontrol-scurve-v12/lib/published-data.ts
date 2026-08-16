import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProjectId } from "@/lib/project";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";
import { databaseErrorMessage } from "@/lib/publishing/versioned-publisher";
import type {
  DocumentRecordInput,
  ProgressSeriesPoint,
  PublishedProjectUpdate,
  ScheduleActivityInput
} from "@/lib/types";

type PublishedDataOptions = {
  documents?: boolean;
  progressSeries?: boolean;
  scheduleActivities?: boolean;
};

const READ_PAGE_SIZE = 1000;

async function fetchVersionRows(
  supabase: SupabaseClient,
  table: "document_records" | "progress_points" | "schedule_activities",
  columns: string,
  versionId: string
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("version_id", versionId)
      .order("id", { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1);
    if (error) throw new Error(databaseErrorMessage(error, `${table} could not be loaded.`));
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < READ_PAGE_SIZE) break;
  }
  return rows;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function loadDocuments(supabase: SupabaseClient, versionId: string): Promise<DocumentRecordInput[]> {
  const rows = await fetchVersionRows(
    supabase,
    "document_records",
    "id, document_no, title, system_division, document_type, discipline, subdiscipline, revision, purpose, last_submission_date, last_response_date, last_status, current_action, review_cycles, overdue_days, drive_web_url, source_row",
    versionId
  );
  return rows.map((row) => ({
    documentNo: String(row.document_no ?? ""),
    title: String(row.title ?? ""),
    systemDivision: String(row.system_division ?? ""),
    documentType: String(row.document_type ?? ""),
    discipline: String(row.discipline ?? ""),
    subdiscipline: String(row.subdiscipline ?? ""),
    revision: String(row.revision ?? ""),
    purpose: String(row.purpose ?? ""),
    lastSubmissionDate: row.last_submission_date ? String(row.last_submission_date) : null,
    lastResponseDate: row.last_response_date ? String(row.last_response_date) : null,
    lastStatus: String(row.last_status ?? ""),
    currentAction: String(row.current_action ?? ""),
    reviewCycles: nullableNumber(row.review_cycles),
    overdueDays: nullableNumber(row.overdue_days),
    driveWebUrl: row.drive_web_url ? String(row.drive_web_url) : null,
    sourceRow: nullableNumber(row.source_row) ?? 0
  }));
}

async function loadProgressSeries(supabase: SupabaseClient, versionId: string): Promise<ProgressSeriesPoint[]> {
  const rows = await fetchVersionRows(
    supabase,
    "progress_points",
    "id, frequency, area, discipline, subdiscipline, measure, period_date, incremental_value, cumulative_value",
    versionId
  );
  return rows.map((row) => ({
    frequency: row.frequency === "weekly" ? "weekly" : "monthly",
    area: String(row.area ?? ""),
    discipline: String(row.discipline ?? "Overall"),
    subdiscipline: row.subdiscipline ? String(row.subdiscipline) : null,
    measure: row.measure === "planned" || row.measure === "actual" || row.measure === "forecast"
      ? row.measure
      : "baseline",
    periodDate: String(row.period_date ?? ""),
    incrementalValue: nullableNumber(row.incremental_value),
    cumulativeValue: nullableNumber(row.cumulative_value)
  }));
}

async function loadScheduleActivities(supabase: SupabaseClient, versionId: string): Promise<ScheduleActivityInput[]> {
  const rows = await fetchVersionRows(
    supabase,
    "schedule_activities",
    "id, activity_id, activity_name, wbs_path, discipline, subdiscipline, activity_status, activity_type, baseline_start, baseline_finish, current_start, current_finish, original_duration, remaining_duration, total_float, schedule_percent_complete, performance_percent_complete, is_critical, source_row",
    versionId
  );
  return rows.map((row) => ({
    activityId: String(row.activity_id ?? ""),
    activityName: String(row.activity_name ?? ""),
    wbsPath: String(row.wbs_path ?? ""),
    discipline: String(row.discipline ?? ""),
    subdiscipline: String(row.subdiscipline ?? ""),
    activityStatus: String(row.activity_status ?? ""),
    activityType: String(row.activity_type ?? ""),
    baselineStart: row.baseline_start ? String(row.baseline_start) : null,
    baselineFinish: row.baseline_finish ? String(row.baseline_finish) : null,
    currentStart: row.current_start ? String(row.current_start) : null,
    currentFinish: row.current_finish ? String(row.current_finish) : null,
    originalDuration: nullableNumber(row.original_duration),
    remainingDuration: nullableNumber(row.remaining_duration),
    totalFloat: nullableNumber(row.total_float),
    schedulePercentComplete: nullableNumber(row.schedule_percent_complete),
    performancePercentComplete: nullableNumber(row.performance_percent_complete),
    isCritical: Boolean(row.is_critical),
    sourceRow: nullableNumber(row.source_row) ?? 0
  }));
}

export async function getPublishedProjectUpdate(
  options: PublishedDataOptions = {}
): Promise<PublishedProjectUpdate | null> {
  if (isDemoMode || !isSupabaseConfigured || !process.env.DEFAULT_PROJECT_ID) return null;
  const projectId = getDefaultProjectId();
  if (!projectId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("published_project_updates")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(databaseErrorMessage(error, "Published project data could not be loaded."));
  if (!data) return null;

  const progressAnalysis = data.progress_analysis ?? null;
  const scheduleAnalysis = data.schedule_analysis ?? null;
  const jobs: Promise<void>[] = [];

  if (progressAnalysis && options.documents && data.progress_version_id) {
    jobs.push(loadDocuments(supabase, data.progress_version_id).then((rows) => { progressAnalysis.documents = rows; }));
  }
  if (progressAnalysis && options.progressSeries && data.progress_version_id) {
    jobs.push(loadProgressSeries(supabase, data.progress_version_id).then((rows) => { progressAnalysis.progressSeries = rows; }));
  }
  if (scheduleAnalysis && options.scheduleActivities && data.schedule_version_id) {
    jobs.push(loadScheduleActivities(supabase, data.schedule_version_id).then((rows) => { scheduleAnalysis.scheduleActivities = rows; }));
  }
  await Promise.all(jobs);

  return {
    id: data.id,
    projectId: data.project_id,
    progressFileName: data.progress_file_name,
    scheduleFileName: data.schedule_file_name,
    dataDate: data.data_date,
    progressAnalysis,
    scheduleAnalysis,
    publishedAt: data.published_at,
    publishedBy: data.published_by
  };
}

export function metric(summary: Record<string, string | number | null> | undefined, key: string, fallback: number) {
  const value = Number(summary?.[key]);
  return Number.isFinite(value) ? value : fallback;
}
