import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { getPublishedProjectUpdate } from "@/lib/published-data";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "documents";
}

async function authorize() {
  const user = await getCurrentUser();
  if (!user) return { error: new Response("Authentication required.", { status: 401 }) };
  if (!canAccessSection(user, "document_control")) return { error: new Response("Access denied.", { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const update = await getPublishedProjectUpdate({ documents: true });
  const documents = update?.progressAnalysis?.documents ?? [];
  const headers = ["Document No.", "Title", "System / Division", "Document Type", "Discipline", "Revision", "Purpose", "First ENKA Submission", "Latest ENKA Submission", "Latest Taurus Response", "Status", "Current Action", "Responsible Party", "Contractual Due Date", "Review Cycle Days", "Overdue Days", "Total Running Days", "Hold by Taurus", "Hold by ENKA", "Delay Analysis", "Transmittal No.", "Transmittal Date", "File URL"];
  const rows = documents.map((row) => [row.documentNo, row.title, row.systemDivision, row.documentType, row.discipline, row.revision, row.purpose, row.firstSubmissionDate, row.lastSubmissionDate, row.lastResponseDate, row.lastStatus, row.currentAction, row.responsibleParty, row.dueDate, row.reviewCycleDays, row.overdueDays, row.totalRunningDays, row.holdByTaurusDays, row.holdByEnkaDays, row.delayAnalysis, row.transmittalNo, row.transmittalDate, row.driveWebUrl]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=taurus-document-register.csv"
    }
  });
}

type ExportRow = {
  documentNo?: string; title?: string; discipline?: string; subdiscipline?: string; revision?: string; purpose?: string;
  lastSubmissionDate?: string | null; lastResponseDate?: string | null; lastStatus?: string; responsibleParty?: string;
  reviewStage?: string; dueDate?: string | null; overdueDays?: number | null; daysUntilDue?: number | null; reviewCycleDays?: number | null;
  transmittalNo?: string; transmittalDate?: string | null; driveWebUrl?: string | null;
};

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  let payload: { title?: string; rows?: ExportRow[] };
  try { payload = await request.json(); }
  catch { return new Response("Invalid export request.", { status: 400 }); }

  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 20_000) : [];
  const title = String(payload.title || "KPI Documents").slice(0, 100);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Taurus Project Control";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("KPI Documents", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Document No.", key: "documentNo", width: 28 },
    { header: "Title", key: "title", width: 48 },
    { header: "Discipline", key: "discipline", width: 22 },
    { header: "Subdiscipline", key: "subdiscipline", width: 22 },
    { header: "Revision", key: "revision", width: 12 },
    { header: "Purpose", key: "purpose", width: 18 },
    { header: "Latest ENKA Submission", key: "lastSubmissionDate", width: 21 },
    { header: "Latest Taurus Response", key: "lastResponseDate", width: 21 },
    { header: "Status", key: "lastStatus", width: 28 },
    { header: "Responsible / Overdue By", key: "responsibleParty", width: 24 },
    { header: "Review Stage", key: "reviewStage", width: 24 },
    { header: "Contractual Due Date", key: "dueDate", width: 21 },
    { header: "Overdue Days", key: "overdueDays", width: 15 },
    { header: "Days Until Due", key: "daysUntilDue", width: 15 },
    { header: "Review Cycle Days", key: "reviewCycleDays", width: 18 },
    { header: "Transmittal No.", key: "transmittalNo", width: 24 },
    { header: "Transmittal Date", key: "transmittalDate", width: 18 },
    { header: "Source File", key: "driveWebUrl", width: 40 }
  ];

  rows.forEach((row) => sheet.addRow(row));
  sheet.autoFilter = { from: "A1", to: "R1" };
  sheet.getRow(1).height = 26;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123153" } };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFD9E2EC" } } }; });
  });

  const overdueColumn = sheet.getColumn("overdueDays");
  overdueColumn.eachCell((cell, rowNumber) => {
    if (rowNumber > 1 && typeof cell.value === "number" && cell.value > 0) cell.font = { bold: true, color: { argb: "FFD64251" } };
  });

  const summary = workbook.addWorksheet("Export Info");
  summary.addRows([["TAURUS PROJECT CONTROL"], ["KPI Drill-down Export"], ["KPI", title], ["Exported Rows", rows.length], ["Generated", new Date().toISOString()]]);
  summary.getColumn(1).width = 22; summary.getColumn(2).width = 42;
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: "FF123153" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="taurus-${safeName(title)}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}
