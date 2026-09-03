import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { detectAndImportWorkbook } from "@/lib/importers/detect-workbook";
import { createAuthorizedDataClient } from "@/lib/supabase/data";
import { getDefaultProjectId } from "@/lib/project";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FIRST_STEP_UPLOAD = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Only a Super Admin or Project Administrator can manage controlled project publishing." }, { status: 403 });
  if (!canAccessSection(user, "imports", "manage")) {
    return NextResponse.json({ error: "Import-management permission is required." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Select an Excel workbook." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Phase 1 accepts .xlsx files only." }, { status: 415 });
  }
  if (file.size > MAX_FIRST_STEP_UPLOAD) {
    return NextResponse.json(
      { error: "This Phase 1 preview is limited to 4 MB. OneDrive resumable uploads are added in Phase 2." },
      { status: 413 }
    );
  }

  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
    return NextResponse.json({ error: "The selected file is not a valid XLSX package." }, { status: 422 });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const analysis = detectAndImportWorkbook(workbook, file.name, file.size);
    const { documents: _documents, progressSeries: _progressSeries, scheduleActivities: _scheduleActivities, ...preview } = analysis;
    {
      const supabase = await createAuthorizedDataClient();
      await supabase.from("audit_log").insert({
        actor_id: user.id,
        event_type: "import.previewed",
        entity_type: "workbook",
        entity_id: file.name,
        project_id: getDefaultProjectId(),
        details: {
          file_name: file.name,
          file_size: file.size,
          workbook_kind: preview.kind,
          valid: preview.valid,
          actor_name: user.fullName,
          actor_email: user.email
        }
      });
    }
    return NextResponse.json(preview, { status: preview.valid ? 200 : 422 });
  } catch {
    return NextResponse.json(
      { error: "The workbook could not be read. Confirm it opens correctly in Excel and try again." },
      { status: 422 }
    );
  }
}
