import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProgressAnalysisSnapshot,
  ScheduleAnalysisSnapshot,
  WorkbookAnalysis
} from "@/lib/types";

const WRITE_BATCH_SIZE = 300;

export type StagedWorkbookVersion = {
  kind: "progress" | "schedule";
  versionId: string;
  importRunId: string;
  compactProgress: ProgressAnalysisSnapshot | null;
  compactSchedule: ScheduleAnalysisSnapshot | null;
};

export function databaseErrorMessage(error: unknown, fallback = "Database operation failed.") {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const source = error as Record<string, unknown>;
    const parts = [source.message, source.details, source.hint]
      .map((value) => typeof value === "string" ? value.trim() : "")
      .filter(Boolean);
    if (parts.length) return [...new Set(parts)].join(" ");
    if (typeof source.code === "string") return `${fallback} (${source.code})`;
  }
  return fallback;
}

function migrationMessage(error: unknown) {
  const message = databaseErrorMessage(error);
  if (/progress_version_id|schedule_version_id|subdiscipline|schema cache|does not exist/i.test(message)) {
    return "Database upgrade 0006 is required. In Supabase SQL Editor, run supabase/migrations/0006_reliable_versioned_excel_publishing.sql, then try the upload again.";
  }
  if (/permission denied|row-level security|policy/i.test(message)) {
    return "Supabase rejected the publishing write. Run migrations 0005 and 0006 in Supabase SQL Editor, confirm this account is an active Super Admin, then try again.";
  }
  return message;
}

async function insertBatches(
  supabase: SupabaseClient,
  table: "document_records" | "progress_points" | "schedule_activities",
  rows: Record<string, unknown>[],
  label: string
) {
  for (let start = 0; start < rows.length; start += WRITE_BATCH_SIZE) {
    const { error } = await supabase.from(table).insert(rows.slice(start, start + WRITE_BATCH_SIZE));
    if (error) {
      throw new Error(`${label} could not be stored at rows ${start + 1}–${Math.min(start + WRITE_BATCH_SIZE, rows.length)}. ${migrationMessage(error)}`);
    }
  }
}

export function compactProgressAnalysis(analysis: WorkbookAnalysis): ProgressAnalysisSnapshot {
  return {
    fileName: analysis.fileName,
    title: analysis.title,
    summary: analysis.summary,
    chart: analysis.chart ?? [],
    distributions: analysis.distributions ?? {},
    documents: [],
    progressSeries: [],
    warnings: analysis.warnings
  };
}

export function compactScheduleAnalysis(analysis: WorkbookAnalysis): ScheduleAnalysisSnapshot {
  return {
    fileName: analysis.fileName,
    title: analysis.title,
    summary: analysis.summary,
    distributions: analysis.distributions ?? {},
    scheduleActivities: [],
    warnings: analysis.warnings
  };
}

export async function stageWorkbookVersion(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  analysis: WorkbookAnalysis
): Promise<StagedWorkbookVersion> {
  let importRunId: string | null = null;
  let versionId: string | null = null;

  try {
    const { data: importRun, error: importError } = await supabase
      .from("import_runs")
      .insert({
        project_id: projectId,
        kind: analysis.kind,
        status: "validating",
        file_name: analysis.fileName,
        file_size_bytes: analysis.fileSize,
        storage_provider: "vercel_direct",
        validation_result: {
          valid: analysis.valid,
          warnings: analysis.warnings,
          errors: analysis.errors,
          sheets: analysis.sheets
        },
        uploaded_by: userId
      })
      .select("id")
      .single();
    if (importError || !importRun) throw new Error(`Import record could not be created. ${migrationMessage(importError)}`);
    importRunId = importRun.id;

    const { data: latestVersion, error: versionReadError } = await supabase
      .from("data_versions")
      .select("version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionReadError) throw new Error(`Version number could not be read. ${migrationMessage(versionReadError)}`);

    const versionNumber = Number(latestVersion?.version_number ?? 0) + 1;
    const dataDate = String(analysis.summary.dataDate ?? "") || null;
    const { data: version, error: versionError } = await supabase
      .from("data_versions")
      .insert({
        project_id: projectId,
        import_run_id: importRunId,
        version_number: versionNumber,
        status: "staging",
        data_date: dataDate,
        notes: `${analysis.kind} workbook: ${analysis.fileName}`,
        created_by: userId
      })
      .select("id")
      .single();
    if (versionError || !version) throw new Error(`Data version could not be created. ${migrationMessage(versionError)}`);
    versionId = version.id;

    if (analysis.kind === "progress") {
      const documents = (analysis.documents ?? []).map((row) => ({
        version_id: versionId,
        document_no: row.documentNo,
        title: row.title,
        system_division: row.systemDivision,
        document_type: row.documentType,
        discipline: row.discipline,
        subdiscipline: row.subdiscipline,
        revision: row.revision,
        purpose: row.purpose,
        last_submission_date: row.lastSubmissionDate,
        last_response_date: row.lastResponseDate,
        last_status: row.lastStatus,
        current_action: row.currentAction,
        review_cycles: row.reviewCycles,
        overdue_days: row.overdueDays,
        drive_web_url: row.driveWebUrl,
        source_row: row.sourceRow
      }));
      const points = (analysis.progressSeries ?? []).map((row) => ({
        version_id: versionId,
        frequency: row.frequency,
        area: row.area,
        discipline: row.discipline,
        subdiscipline: row.subdiscipline,
        measure: row.measure,
        period_date: row.periodDate,
        incremental_value: row.incrementalValue,
        cumulative_value: row.cumulativeValue
      }));
      await insertBatches(supabase, "document_records", documents, "Document register");
      await insertBatches(supabase, "progress_points", points, "Progress curves");
    } else {
      const activities = (analysis.scheduleActivities ?? []).map((row) => ({
        version_id: versionId,
        activity_id: row.activityId,
        activity_name: row.activityName,
        wbs_path: row.wbsPath,
        discipline: row.discipline,
        subdiscipline: row.subdiscipline,
        activity_status: row.activityStatus,
        activity_type: row.activityType,
        baseline_start: row.baselineStart,
        baseline_finish: row.baselineFinish,
        current_start: row.currentStart,
        current_finish: row.currentFinish,
        original_duration: row.originalDuration,
        remaining_duration: row.remainingDuration,
        total_float: row.totalFloat,
        schedule_percent_complete: row.schedulePercentComplete,
        performance_percent_complete: row.performancePercentComplete,
        is_critical: row.isCritical,
        source_row: row.sourceRow
      }));
      await insertBatches(supabase, "schedule_activities", activities, "Schedule activities");
    }

    const { error: readyError } = await supabase
      .from("import_runs")
      .update({ status: "ready", completed_at: new Date().toISOString() })
      .eq("id", importRunId);
    if (readyError) throw new Error(`Import status could not be updated. ${migrationMessage(readyError)}`);

    return {
      kind: analysis.kind,
      versionId: versionId!,
      importRunId: importRunId!,
      compactProgress: analysis.kind === "progress" ? compactProgressAnalysis(analysis) : null,
      compactSchedule: analysis.kind === "schedule" ? compactScheduleAnalysis(analysis) : null
    };
  } catch (error) {
    if (versionId) await supabase.from("data_versions").delete().eq("id", versionId);
    if (importRunId) await supabase.from("import_runs").delete().eq("id", importRunId);
    throw error;
  }
}

export async function removeStagedVersions(
  supabase: SupabaseClient,
  staged: StagedWorkbookVersion[]
) {
  for (const item of staged) {
    await supabase.from("data_versions").delete().eq("id", item.versionId);
    await supabase.from("import_runs").delete().eq("id", item.importRunId);
  }
}
