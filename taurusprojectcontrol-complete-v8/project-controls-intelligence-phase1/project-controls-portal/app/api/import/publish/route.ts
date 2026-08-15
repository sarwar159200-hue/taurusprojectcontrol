import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { detectAndImportWorkbook } from "@/lib/importers/detect-workbook";
import { createAuthorizedDataClient } from "@/lib/supabase/data";
import { getDefaultProjectId } from "@/lib/project";
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

    const supabase = await createAuthorizedDataClient();
    const projectId = getDefaultProjectId();
    if (!projectId) return NextResponse.json({ error: "DEFAULT_PROJECT_ID is missing or invalid in Vercel." }, { status: 500 });
    const { data: existing, error: existingError } = await supabase
      .from("published_project_updates")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (existingError) throw existingError;
    let progress = (existing?.progress_analysis ?? null) as ProgressAnalysisSnapshot | null;
    let schedule = (existing?.schedule_analysis ?? null) as ScheduleAnalysisSnapshot | null;
    for (const analysis of analyses) {
      if (analysis.kind === "progress") progress = { fileName: analysis.fileName, title: analysis.title, summary: analysis.summary, chart: analysis.chart ?? [], distributions: analysis.distributions ?? {}, documents: analysis.documents ?? [], progressSeries: analysis.progressSeries ?? [], warnings: analysis.warnings };
      else schedule = { fileName: analysis.fileName, title: analysis.title, summary: analysis.summary, distributions: analysis.distributions ?? {}, scheduleActivities: analysis.scheduleActivities ?? [], warnings: analysis.warnings };
    }
    const dataDate = String(progress?.summary.dataDate ?? schedule?.summary.dataDate ?? "") || null;
    const row = { project_id: projectId, progress_file_name: progress?.fileName ?? null, schedule_file_name: schedule?.fileName ?? null, data_date: dataDate, progress_analysis: progress, schedule_analysis: schedule, published_by: user.id, published_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("published_project_updates").upsert(row, { onConflict: "project_id" });
    if (error) {
      if (/permission denied|row-level security/i.test(error.message)) {
        throw new Error("Publishing permission was rejected. Confirm SUPABASE_SERVICE_ROLE_KEY is the sb_secret_ key from the same Supabase project, then redeploy.");
      }
      throw error;
    }
    await supabase.from("audit_log").insert({ actor_id: user.id, event_type: "import.published", entity_type: "project_update", entity_id: projectId, project_id: projectId, details: { files: files.map((f) => f.name), actor_name: user.fullName, actor_email: user.email } });
    revalidatePath("/dashboard", "layout");
    return NextResponse.json({ publishedAt: row.published_at, previews: analyses.map(publicPreview) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The update could not be published." }, { status: 500 });
  }
}
