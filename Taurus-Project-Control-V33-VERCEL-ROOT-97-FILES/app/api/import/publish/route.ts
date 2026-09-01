import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { detectAndImportWorkbook } from "@/lib/importers/detect-workbook";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProjectId } from "@/lib/project";
import {
  databaseErrorMessage,
  removeStagedVersions,
  stageWorkbookVersion,
  type StagedWorkbookVersion
} from "@/lib/publishing/versioned-publisher";
import { resolvePublishedDataDate } from "@/lib/publishing/data-date";
import type { ProgressAnalysisSnapshot, ScheduleAnalysisSnapshot, WorkbookAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_FILE = 8 * 1024 * 1024;

function publicPreview(analysis: WorkbookAnalysis) {
  const { documents: _d, progressSeries: _p, scheduleActivities: _s, ...preview } = analysis;
  return preview;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Only a Super Admin or Project Administrator can manage controlled project publishing." }, { status: 403 });
  if (!canAccessSection(user, "imports", "manage")) return NextResponse.json({ error: "Import-management permission is required." }, { status: 403 });

  const files = (await request.formData()).getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length || files.length > 2) return NextResponse.json({ error: "Select one or two Excel workbooks." }, { status: 400 });
  if (files.some((file) => !file.name.toLowerCase().endsWith(".xlsx") || file.size > MAX_FILE)) {
    return NextResponse.json({ error: "Use XLSX files no larger than 8 MB each." }, { status: 415 });
  }

  try {
    const analyses: WorkbookAnalysis[] = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes);
      const analysis = detectAndImportWorkbook(workbook, file.name, file.size);
      if (!analysis.valid) return NextResponse.json({ error: analysis.errors.join(" "), preview: publicPreview(analysis) }, { status: 422 });
      if (analyses.some((item) => item.kind === analysis.kind)) return NextResponse.json({ error: `Two ${analysis.kind} workbooks were selected.` }, { status: 422 });
      analyses.push(analysis);
    }

    // Publishing uses the signed-in administrator plus RLS policies installed
    // by migration 0006. It does not depend on the server secret being valid.
    const supabase = await createClient();
    const projectId = getDefaultProjectId();
    if (!projectId) return NextResponse.json({ error: "DEFAULT_PROJECT_ID is missing or invalid in Vercel." }, { status: 500 });
    const { data: existing, error: existingError } = await supabase
      .from("published_project_updates")
      .select("id, progress_file_name, schedule_file_name, data_date, progress_analysis, schedule_analysis, progress_version_id, schedule_version_id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (existingError) {
      const message = databaseErrorMessage(existingError);
      if (/progress_version_id|schedule_version_id|schema cache|does not exist/i.test(message)) {
        throw new Error("Database upgrade 0006 is required. Run supabase/migrations/0006_reliable_versioned_excel_publishing.sql in Supabase SQL Editor, then upload again.");
      }
      throw new Error(`Published-data access failed. ${message}`);
    }
    let progress = (existing?.progress_analysis ?? null) as ProgressAnalysisSnapshot | null;
    let schedule = (existing?.schedule_analysis ?? null) as ScheduleAnalysisSnapshot | null;
    let progressVersionId = existing?.progress_version_id ?? null;
    let scheduleVersionId = existing?.schedule_version_id ?? null;
    const staged: StagedWorkbookVersion[] = [];
    try {
      for (const analysis of analyses) {
        const version = await stageWorkbookVersion(supabase, projectId, user.id, analysis);
        staged.push(version);
        if (version.kind === "progress") {
          progress = version.compactProgress;
          progressVersionId = version.versionId;
        } else {
          schedule = version.compactSchedule;
          scheduleVersionId = version.versionId;
        }
      }
    } catch (error) {
      await removeStagedVersions(supabase, staged);
      throw error;
    }
    // Trim any legacy v8 arrays before the compact pointer row is written.
    // The full rows now live under their independent version IDs.
    if (progress && progressVersionId) progress = { ...progress, documents: [], progressSeries: [] };
    if (schedule && scheduleVersionId) schedule = { ...schedule, scheduleActivities: [] };
    const dataDate = resolvePublishedDataDate(progress, schedule);
    const row = {
      project_id: projectId,
      progress_file_name: progress?.fileName ?? null,
      schedule_file_name: schedule?.fileName ?? null,
      data_date: dataDate,
      progress_analysis: progress,
      schedule_analysis: schedule,
      progress_version_id: progressVersionId,
      schedule_version_id: scheduleVersionId,
      published_by: user.id,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from("published_project_updates").upsert(row, { onConflict: "project_id" });
    if (error) {
      await removeStagedVersions(supabase, staged);
      const message = databaseErrorMessage(error);
      if (/permission denied|row-level security|policy/i.test(message)) {
        throw new Error("Publishing permission was rejected. Run migrations 0005 and 0006 in Supabase SQL Editor and confirm your profile is an active Super Admin.");
      }
      throw new Error(`The analyzed update could not be published. ${message}`);
    }

    for (const item of staged) {
      await supabase.from("data_versions").update({
        status: "published",
        published_by: user.id,
        published_at: row.published_at
      }).eq("id", item.versionId);
      await supabase.from("import_runs").update({ status: "published" }).eq("id", item.importRunId);
    }
    const latestVersion = staged.at(-1)?.versionId;
    if (latestVersion) await supabase.from("projects").update({ published_version_id: latestVersion }).eq("id", projectId);

    const replacedVersionIds = [
      analyses.some((item) => item.kind === "progress") ? existing?.progress_version_id : null,
      analyses.some((item) => item.kind === "schedule") ? existing?.schedule_version_id : null
    ].filter((value): value is string => Boolean(value) && !staged.some((item) => item.versionId === value));
    if (replacedVersionIds.length) {
      await supabase.from("data_versions").update({ status: "superseded" }).in("id", replacedVersionIds);
    }
    await supabase.from("audit_log").insert({ actor_id: user.id, event_type: "import.published", entity_type: "project_update", entity_id: projectId, project_id: projectId, details: { files: files.map((f) => f.name), data_date: dataDate, data_date_source: schedule?.summary.dataDate ? "project_schedule" : "progress_fallback", actor_name: user.fullName, actor_email: user.email } });
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({ publishedAt: row.published_at, dataDate, previews: analyses.map(publicPreview) });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error, "The update could not be published.") }, { status: 500 });
  }
}
