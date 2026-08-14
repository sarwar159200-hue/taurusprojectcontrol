import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import { detectAndImportWorkbook } from "@/lib/importers/detect-workbook";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FIRST_STEP_UPLOAD = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
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

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return NextResponse.json({ error: "The selected file is not a valid XLSX package." }, { status: 422 });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const preview = detectAndImportWorkbook(workbook, file.name, file.size);
    return NextResponse.json(preview, { status: preview.valid ? 200 : 422 });
  } catch {
    return NextResponse.json(
      { error: "The workbook could not be read. Confirm it opens correctly in Excel and try again." },
      { status: 422 }
    );
  }
}
