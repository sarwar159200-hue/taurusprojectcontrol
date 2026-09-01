import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";

type ExportRow = {
  activityId?: string;
  activityName?: string;
  wbsPath?: string;
  discipline?: string;
  subdiscipline?: string;
  activityStatus?: string;
  activityType?: string;
  baselineStart?: string | null;
  baselineFinish?: string | null;
  currentStart?: string | null;
  currentFinish?: string | null;
  originalDuration?: number | null;
  remainingDuration?: number | null;
  totalFloat?: number | null;
  schedulePercentComplete?: number | null;
  performancePercentComplete?: number | null;
  isCritical?: boolean;
  sourceRow?: number;
};

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "schedule";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentication required.", { status: 401 });
  if (!canAccessSection(user, "schedule")) return new Response("Access denied.", { status: 403 });

  let payload: { title?: string; rows?: ExportRow[] };
  try { payload = await request.json(); }
  catch { return new Response("Invalid export request.", { status: 400 }); }

  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 25_000) : [];
  const title = String(payload.title || "Schedule Activities").slice(0, 100);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Taurus Project Control";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Schedule Activities", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Activity ID", key: "activityId", width: 18 },
    { header: "Activity Name", key: "activityName", width: 48 },
    { header: "WBS Path", key: "wbsPath", width: 38 },
    { header: "Discipline", key: "discipline", width: 22 },
    { header: "Sub-Discipline", key: "subdiscipline", width: 24 },
    { header: "Status", key: "activityStatus", width: 20 },
    { header: "Activity Type", key: "activityType", width: 18 },
    { header: "Baseline Start", key: "baselineStart", width: 18 },
    { header: "Baseline Finish", key: "baselineFinish", width: 18 },
    { header: "Current Start", key: "currentStart", width: 18 },
    { header: "Current Finish", key: "currentFinish", width: 18 },
    { header: "Original Duration", key: "originalDuration", width: 18 },
    { header: "Remaining Duration", key: "remainingDuration", width: 19 },
    { header: "Total Float", key: "totalFloat", width: 14 },
    { header: "Schedule %", key: "schedulePercentComplete", width: 14 },
    { header: "Performance %", key: "performancePercentComplete", width: 16 },
    { header: "Critical", key: "isCritical", width: 12 },
    { header: "Source Row", key: "sourceRow", width: 12 }
  ];

  rows.forEach((row) => sheet.addRow({ ...row, isCritical: row.isCritical ? "Yes" : "No" }));
  sheet.autoFilter = { from: "A1", to: "R1" };
  const header = sheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123153" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFD9E2EC" } } }; });
  });

  const info = workbook.addWorksheet("Export Info");
  info.addRows([
    ["TAURUS PROJECT CONTROL"],
    ["Schedule Drill-down Export"],
    ["Selection", title],
    ["Exported Rows", rows.length],
    ["Generated", new Date().toISOString()]
  ]);
  info.getColumn(1).width = 24;
  info.getColumn(2).width = 48;
  info.getRow(1).font = { bold: true, size: 16, color: { argb: "FF123153" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="taurus-${safeName(title)}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}
