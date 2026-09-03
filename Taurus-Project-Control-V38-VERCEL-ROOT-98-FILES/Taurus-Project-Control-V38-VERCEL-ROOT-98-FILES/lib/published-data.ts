import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const first = await supabase
      .from(table)
      .select(columns, { count: "exact" })
      .eq("version_id", versionId)
      .order("id", { ascending: true })
      .range(0, READ_PAGE_SIZE - 1);
  if (first.error) throw new Error(databaseErrorMessage(first.error, `${table} could not be loaded.`));
  const firstPage = (first.data ?? []) as unknown as Record<string, unknown>[];
  const total = first.count ?? firstPage.length;
  if (total <= firstPage.length) return firstPage;

  const requests: Array<Promise<Record<string, unknown>[]>> = [];
  for (let from = READ_PAGE_SIZE; from < total; from += READ_PAGE_SIZE) {
    requests.push((async () => {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq("version_id", versionId)
        .order("id", { ascending: true })
        .range(from, Math.min(from + READ_PAGE_SIZE - 1, total - 1));
      if (error) throw new Error(databaseErrorMessage(error, `${table} could not be loaded.`));
      return (data ?? []) as unknown as Record<string, unknown>[];
    })());
  }
  return firstPage.concat(...await Promise.all(requests));
}

const loadPublishedUpdateRow = cache(async () => {
  if (isDemoMode || !isSupabaseConfigured || !process.env.DEFAULT_PROJECT_ID) return null;
  const projectId = getDefaultProjectId();
  if (!projectId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("published_project_updates")
    .select("id, project_id, progress_file_name, schedule_file_name, data_date, progress_analysis, schedule_analysis, progress_version_id, schedule_version_id, published_at, published_by")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(databaseErrorMessage(error, "Published project data could not be loaded."));
  return data ? { data, projectId, supabase } : null;
});

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function loadDocumentsWithClient(supabase: SupabaseClient, versionId: string): Promise<DocumentRecordInput[]> {
  const extendedColumns = "document_no, title, system_division, document_type, discipline, subdiscipline, revision, purpose, first_submission_date, last_submission_date, last_response_date, last_status, current_action, review_cycles, review_cycle_days, due_date, responsible_party, overdue_days, total_running_days, hold_by_taurus_days, hold_by_enka_days, delay_analysis, transmittal_no, transmittal_date, drive_web_url, source_row";
  const legacyColumns = "document_no, title, system_division, document_type, discipline, subdiscipline, revision, purpose, last_submission_date, last_response_date, last_status, current_action, review_cycles, overdue_days, drive_web_url, source_row";
  let rows: Record<string, unknown>[];
  try {
    rows = await fetchVersionRows(supabase, "document_records", extendedColumns, versionId);
  } catch {
    rows = await fetchVersionRows(supabase, "document_records", legacyColumns, versionId);
  }
  return rows.map((row) => ({
    documentNo: String(row.document_no ?? ""),
    title: String(row.title ?? ""),
    systemDivision: String(row.system_division ?? ""),
    documentType: String(row.document_type ?? ""),
    discipline: String(row.discipline ?? ""),
    subdiscipline: String(row.subdiscipline ?? ""),
    revision: String(row.revision ?? ""),
    purpose: String(row.purpose ?? ""),
    firstSubmissionDate: row.first_submission_date ? String(row.first_submission_date) : null,
    lastSubmissionDate: row.last_submission_date ? String(row.last_submission_date) : null,
    lastResponseDate: row.last_response_date ? String(row.last_response_date) : null,
    lastStatus: String(row.last_status ?? ""),
    currentAction: String(row.current_action ?? ""),
    reviewCycles: nullableNumber(row.review_cycles),
    reviewCycleDays: nullableNumber(row.review_cycle_days),
    dueDate: row.due_date ? String(row.due_date) : null,
    responsibleParty: String(row.responsible_party ?? ""),
    overdueDays: nullableNumber(row.overdue_days),
    totalRunningDays: nullableNumber(row.total_running_days),
    holdByTaurusDays: nullableNumber(row.hold_by_taurus_days),
    holdByEnkaDays: nullableNumber(row.hold_by_enka_days),
    delayAnalysis: String(row.delay_analysis ?? ""),
    transmittalNo: String(row.transmittal_no ?? ""),
    transmittalDate: row.transmittal_date ? String(row.transmittal_date) : null,
    driveWebUrl: row.drive_web_url ? String(row.drive_web_url) : null,
    sourceRow: nullableNumber(row.source_row) ?? 0
  }));
}

async function loadProgressSeriesWithClient(supabase: SupabaseClient, versionId: string): Promise<ProgressSeriesPoint[]> {
  const rows = await fetchVersionRows(
    supabase,
    "progress_points",
    "frequency, area, discipline, subdiscipline, measure, period_date, incremental_value, cumulative_value",
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

async function loadScheduleActivitiesWithClient(supabase: SupabaseClient, versionId: string): Promise<ScheduleActivityInput[]> {
  const rows = await fetchVersionRows(
    supabase,
    "schedule_activities",
    "activity_id, activity_name, wbs_path, discipline, subdiscipline, activity_status, activity_type, baseline_start, baseline_finish, current_start, current_finish, original_duration, remaining_duration, total_float, schedule_percent_complete, performance_percent_complete, is_critical, source_row",
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

// Published version rows never change after a successful publish. When a valid
// server secret is configured, cache immutable version rows for very fast tab
// changes. If the server secret is missing/mismatched, fall back to the signed-in
// user's RLS-authorized Supabase client instead of crashing the dashboard.
function loadDocuments(versionId: string) {
  return unstable_cache(
    () => loadDocumentsWithClient(createAdminClient(), versionId),
    ["taurus-documents", versionId],
    { revalidate: 86400 }
  )();
}

function loadProgressSeries(versionId: string) {
  return unstable_cache(
    () => loadProgressSeriesWithClient(createAdminClient(), versionId),
    ["taurus-progress-series", versionId],
    { revalidate: 86400 }
  )();
}

function loadScheduleActivities(versionId: string) {
  return unstable_cache(
    () => loadScheduleActivitiesWithClient(createAdminClient(), versionId),
    ["taurus-schedule-activities", versionId],
    { revalidate: 86400 }
  )();
}

export async function getPublishedProjectUpdate(
  options: PublishedDataOptions = {}
): Promise<PublishedProjectUpdate | null> {
  const loaded = await loadPublishedUpdateRow();
  if (!loaded) return null;
  const { data, projectId, supabase } = loaded;

  const progressAnalysis = data.progress_analysis ?? null;
  const scheduleAnalysis = data.schedule_analysis ?? null;
  const jobs: Promise<void>[] = [];

  if (progressAnalysis && options.documents && data.progress_version_id) {
    jobs.push(loadDocuments(data.progress_version_id).catch(() => loadDocumentsWithClient(supabase, data.progress_version_id)).then((rows) => { progressAnalysis.documents = rows; }));
  }
  if (progressAnalysis && options.progressSeries && data.progress_version_id) {
    jobs.push(loadProgressSeries(data.progress_version_id).catch(() => loadProgressSeriesWithClient(supabase, data.progress_version_id)).then((rows) => { progressAnalysis.progressSeries = rows; }));
  }
  if (scheduleAnalysis && options.scheduleActivities && data.schedule_version_id) {
    jobs.push(loadScheduleActivities(data.schedule_version_id).catch(() => loadScheduleActivitiesWithClient(supabase, data.schedule_version_id)).then((rows) => { scheduleAnalysis.scheduleActivities = rows; }));
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
