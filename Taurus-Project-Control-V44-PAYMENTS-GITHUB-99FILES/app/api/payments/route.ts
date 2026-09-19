import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { canUploadPaymentsByEmail } from "@/lib/roles";
import { createAuthorizedDataClient } from "@/lib/supabase/data";
import { getDefaultProjectId } from "@/lib/project";
import { PROJECT_NAME } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_PAYMENT_UPLOAD = 15 * 1024 * 1024;

type Supplier = { supplier: string; originalValue: number; variations: number; currentValue: number; paid: number; remaining: number; paymentPercent: number };
type Variation = { voNo: string; supplier: string; description: string; amount: number; currency: string; amountUsd: number | null; status: string; approvedDate: string | null };
type PaymentSnapshot = {
  sourceFile: string; dataDate: string | null; uploadedAt: string; uploadedBy: string;
  originalValue: number; totalVariations: number; currentValue: number; totalPaid: number; remaining: number; paymentPercent: number;
  suppliers: Supplier[]; variations: Variation[];
  currencyNote: string;
};

const n = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value && typeof value === "object" && "result" in value) return n((value as { result?: unknown }).result);
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const text = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: Array<{ text?: string }> };
    if (v.text) return v.text;
    if (v.richText) return v.richText.map((x) => x.text ?? "").join("");
    if (v.result != null) return String(v.result);
  }
  return String(value);
};
const norm = (value: unknown) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const excelDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const serial = n(value); if (!serial) return null;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
};
const supplierFrom = (value: unknown) => {
  const s = norm(value);
  if (/\bge\b|stg|steam turbine/.test(s)) return "GE";
  if (/spg|spjdry|spgdry|acc|air cooled/.test(s)) return "SPG";
  if (/\bjc\b|hrsg|heat recovery/.test(s)) return "JC";
  if (/gsu|generator step/.test(s)) return "GSU";
  return "";
};
function result(cell: { value: unknown }) { return n(cell.value); }
function sheetByLooseName(workbook: ExcelJS.Workbook, wanted: string) {
  return workbook.worksheets.find((s) => norm(s.name) === norm(wanted));
}
function getLatestNumber(sheet: ExcelJS.Worksheet, column: number) {
  let value = 0;
  sheet.eachRow((row) => { const x = result(row.getCell(column)); if (x) value = x; });
  return value;
}
function parseDataDate(fileName: string, ipa: ExcelJS.Worksheet) {
  const m = fileName.match(/(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/);
  if (m) {
    const d = new Date(`${m[2]} ${m[1]}, ${m[3]} UTC`);
    if (!Number.isNaN(d.valueOf())) return d.toISOString().slice(0, 10);
  }
  let latest: string | null = null;
  ipa.eachRow((row, rowNo) => { if (rowNo > 1 && norm(row.getCell(25).value) === "yes") latest = excelDate(row.getCell(26).value) ?? latest; });
  return latest;
}
function supplierMilestoneMap(workbook: ExcelJS.Workbook) {
  const map = new Map<string, string>();
  const defs: Array<[string, string, number]> = [["ITEM 2 - GE(STG)", "GE", 3], ["ITEM 2 - SPGDRY(ACC)", "SPG", 4], ["ITEM 2 - JC(HRSG)", "JC", 3]];
  defs.forEach(([name, supplier, col]) => {
    const ws = sheetByLooseName(workbook, name); if (!ws) return;
    ws.eachRow((row, rn) => { if (rn >= 6) { const key = norm(row.getCell(col).value); if (key.length > 5) map.set(key, supplier); } });
  });
  return map;
}
function classifyPayment(value: unknown, milestones: Map<string, string>) {
  const direct = supplierFrom(value); if (direct) return direct;
  const key = norm(value); if (!key) return "";
  for (const [desc, supplier] of milestones) if (key.includes(desc) || desc.includes(key)) return supplier;
  return "";
}
function supplierCurrentValues(workbook: ExcelJS.Workbook) {
  const ge = sheetByLooseName(workbook, "ITEM 2 - GE(STG)");
  const spg = sheetByLooseName(workbook, "ITEM 2 - SPGDRY(ACC)");
  const jc = sheetByLooseName(workbook, "ITEM 2 - JC(HRSG)");
  const price = sheetByLooseName(workbook, "Price Breakdown");
  const original: Record<string, number> = { GE: 0, SPG: 0, JC: 0, GSU: 0 };
  const current: Record<string, number> = { GE: 0, SPG: 0, JC: 0, GSU: 0 };
  // Use the workbook's own FX assumptions from the supplier schedules to convert
  // original multi-currency supplier values into the same USD-equivalent basis.
  const eurUsd = ge ? result(ge.getCell("U1")) : 0;
  const plnUsd = ge ? result(ge.getCell("U2")) : 0;
  if (price) {
    original.GE = result(price.getCell("B5")) + result(price.getCell("B6")) + result(price.getCell("C5")) * eurUsd + result(price.getCell("D5")) * plnUsd;
    original.SPG = result(price.getCell("B9")) + result(price.getCell("B10"));
    original.JC = result(price.getCell("B7")) + (result(price.getCell("C7")) + result(price.getCell("C8"))) * eurUsd;
    original.GSU = result(price.getCell("B11"));
  }
  if (ge) current.GE = result(ge.getCell("O4")) || original.GE;
  if (spg) current.SPG = result(spg.getCell("P4")) || original.SPG;
  if (jc) current.JC = result(jc.getCell("O4")) || original.JC;
  current.GSU = original.GSU;
  return { original, current };
}
function parseWorkbook(workbook: ExcelJS.Workbook, fileName: string, userEmail: string): PaymentSnapshot {
  const ipa = workbook.worksheets.find((s) => norm(s.name) === "ipa");
  const price = sheetByLooseName(workbook, "Price Breakdown");
  if (!ipa || !price) throw new Error("This is not the expected Bazian II payment workbook: Price Breakdown and IPA sheets are required.");
  const milestones = supplierMilestoneMap(workbook);
  const supplierPaid: Record<string, number> = { GE: 0, SPG: 0, JC: 0, GSU: 0 };

  // Down payments in IPA have explicit supplier references. Later certified rows
  // are resolved from the numbered application tabs so generic descriptions are
  // attributed to the correct equipment supplier where the workbook supports it.
  ipa.eachRow((row, rn) => {
    if (rn < 3 || norm(row.getCell(25).value) !== "yes") return;
    const supplier = classifyPayment(row.getCell(4).value, milestones);
    if (supplier && supplier in supplierPaid) supplierPaid[supplier] += result(row.getCell(9));
  });
  workbook.worksheets.filter((s) => /^\d+$/.test(s.name.trim())).forEach((ws) => {
    ws.eachRow((row, rn) => {
      if (rn < 2) return;
      const supplier = classifyPayment(row.getCell(2).value, milestones);
      if (!supplier || !(supplier in supplierPaid)) return;
      // Numbered tabs are only used for rows whose IPA reference is generic;
      // explicit supplier rows were already counted above, so avoid double count.
      const ref = norm(row.getCell(2).value);
      if (supplierFrom(ref)) return;
      supplierPaid[supplier] += result(row.getCell(8)) || result(row.getCell(7));
    });
  });

  const { original, current } = supplierCurrentValues(workbook);
  const suppliers = ["SPG", "GE", "JC", "GSU"].map((supplier) => {
    const originalValue = original[supplier] || 0;
    const currentValue = current[supplier] || originalValue;
    const paid = supplierPaid[supplier] || 0;
    return { supplier, originalValue, variations: currentValue - originalValue, currentValue, paid, remaining: Math.max(currentValue - paid, 0), paymentPercent: currentValue ? (paid / currentValue) * 100 : 0 };
  });

  const variations: Variation[] = [];
  let vo = 0;
  ipa.eachRow((row, rn) => {
    if (rn <= 1) return;
    const amount = result(row.getCell(40)); // AN Approved Variations
    if (!amount) return;
    vo += 1;
    const currency = text(row.getCell(39).value).trim() || "USD";
    const date = excelDate(row.getCell(35).value); // AI
    const matched = workbook.worksheets.filter((s) => /^\d+$/.test(s.name.trim())).flatMap((ws) => {
      const found: Array<{ desc: string; supplier: string; usd: number }> = [];
      ws.eachRow((r, rNo) => {
        if (rNo < 2) return;
        const desc = text(r.getCell(2).value);
        if (!/change order|variation|vo\s*#/i.test(desc)) return;
        const curr = text(r.getCell(4).value).trim(); const raw = result(r.getCell(5));
        if (curr.toLowerCase() === currency.toLowerCase() && Math.abs(Math.abs(raw) - Math.abs(amount)) < 1) found.push({ desc, supplier: classifyPayment(desc, milestones) || "Project / Unassigned", usd: result(r.getCell(8)) || result(r.getCell(7)) || 0 });
      });
      return found;
    })[0];
    variations.push({ voNo: `VO-${String(vo).padStart(3, "0")}`, supplier: matched?.supplier || "Project / Unassigned", description: matched?.desc || `Approved variation recorded in IPA row ${rn}`, amount, currency, amountUsd: currency.toUpperCase() === "USD" ? amount : (matched?.usd ?? null), status: "Approved", approvedDate: date });
  });

  // Contract KPIs use the workbook's USD contract-price ledger (AQ). This is
  // intentionally not a conversion of the separate EUR/PLN contract ledgers.
  const originalValue = result(ipa.getCell("AQ2"));
  const currentValue = getLatestNumber(ipa, 43) || originalValue;
  const totalVariations = currentValue - originalValue;
  const totalPaid = getLatestNumber(ipa, 32); // AF cumulative paid equivalent USD
  const remaining = Math.max(currentValue - totalPaid, 0);
  return {
    sourceFile: fileName, dataDate: parseDataDate(fileName, ipa), uploadedAt: new Date().toISOString(), uploadedBy: userEmail,
    originalValue, totalVariations, currentValue, totalPaid, remaining, paymentPercent: currentValue ? (totalPaid / currentValue) * 100 : 0,
    suppliers, variations,
    currencyNote: "Main KPIs follow the IPA USD contract-price ledger (AQ) and cumulative paid equivalent USD (AF). EUR and PLN remain separate source ledgers in the workbook; supplier values use the workbook's own USD-equivalent totals where provided."
  };
}
async function loadSnapshot() {
  const projectId = getDefaultProjectId(); if (!projectId) return null;
  const db = await createAuthorizedDataClient();
  const { data, error } = await db.from("payment_dashboard_snapshots").select("snapshot").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  return (data?.snapshot ?? null) as PaymentSnapshot | null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!canAccessSection(user, "payments", "manage") || !canUploadPaymentsByEmail(user.email)) return NextResponse.json({ error: "Payment workbook upload is restricted." }, { status: 403 });
  const projectId = getDefaultProjectId(); if (!projectId) return NextResponse.json({ error: "DEFAULT_PROJECT_ID is not configured." }, { status: 500 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Select an Excel workbook." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Only .xlsx payment workbooks are accepted." }, { status: 415 });
  if (file.size > MAX_PAYMENT_UPLOAD) return NextResponse.json({ error: "Payment workbook exceeds the 15 MB controlled-upload limit." }, { status: 413 });
  try {
    const bytes = await file.arrayBuffer(); const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
    const snapshot = parseWorkbook(workbook, file.name, user.email);
    const db = await createAuthorizedDataClient();
    const { error } = await db.from("payment_dashboard_snapshots").upsert({ project_id: projectId, snapshot, source_file_name: file.name, data_date: snapshot.dataDate, uploaded_by: user.id, uploaded_at: snapshot.uploadedAt }, { onConflict: "project_id" });
    if (error) throw error;
    await db.from("audit_log").insert({ actor_id: user.id, event_type: "payments.published", entity_type: "payment_workbook", entity_id: file.name, project_id: projectId, details: { actor_email: user.email, source_file: file.name, data_date: snapshot.dataDate } });
    revalidatePath("/dashboard/payments");
    return NextResponse.redirect(new URL("/dashboard/payments?uploaded=1", request.url), 303);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment workbook could not be analyzed." }, { status: 422 });
  }
}

function money(value: number) { return Math.round(value * 100) / 100; }
function styleHeader(row: ExcelJS.Row, color = "FF0B2B4B") { row.height = 27; row.font = { bold: true, color: { argb: "FFFFFFFF" } }; row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } }; row.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; }
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentication required.", { status: 401 });
  if (!canAccessSection(user, "payments")) return new Response("Access denied.", { status: 403 });
  const snapshot = await loadSnapshot(); if (!snapshot) return new Response("No payment workbook has been published yet.", { status: 404 });
  const wb = new ExcelJS.Workbook(); wb.creator = "Taurus Project Control"; wb.company = "Taurus"; wb.created = new Date();
  const dash = wb.addWorksheet("Executive Summary", { views: [{ state: "frozen", ySplit: 5 }] });
  dash.mergeCells("A1:H1"); dash.getCell("A1").value = "TAURUS PROJECT CONTROL — PAYMENT DASHBOARD"; dash.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } }; dash.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF08253F" } }; dash.getCell("A1").alignment = { vertical: "middle" }; dash.getRow(1).height = 34;
  dash.mergeCells("A2:H2"); dash.getCell("A2").value = PROJECT_NAME; dash.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF234A73" } };
  dash.addRow(["Data Date", snapshot.dataDate ?? "Not available", "Source File", snapshot.sourceFile, "Uploaded By", snapshot.uploadedBy, "Generated", new Date().toISOString()]);
  dash.addRow([]); dash.addRow(["KPI", "Amount (USD)", "Notes"]); styleHeader(dash.getRow(5));
  [["Original Contract Value", snapshot.originalValue, "IPA USD contract ledger"], ["Total Variations", snapshot.totalVariations, "Current less original"], ["Current Contract Value", snapshot.currentValue, "Original + variations"], ["Total Paid Amount", snapshot.totalPaid, "Cumulative paid equivalent USD"], ["Remaining Amount", snapshot.remaining, "Current less paid"], ["Payment Progress", snapshot.paymentPercent / 100, "% of current contract value"]].forEach((r) => dash.addRow(r));
  dash.getColumn(1).width = 30; dash.getColumn(2).width = 22; dash.getColumn(3).width = 48; dash.getColumn(2).numFmt = '#,##0.00;[Red]-#,##0.00'; dash.getCell("B11").numFmt = "0.0%";
  dash.addRow([]); dash.addRow(["Supplier", "Original Value", "Variations", "Current Value", "Paid", "Remaining", "Payment %"]); styleHeader(dash.getRow(13));
  snapshot.suppliers.forEach((s) => dash.addRow([s.supplier, money(s.originalValue), money(s.variations), money(s.currentValue), money(s.paid), money(s.remaining), s.paymentPercent / 100]));
  for (let c = 2; c <= 6; c++) dash.getColumn(c).numFmt = '#,##0.00;[Red]-#,##0.00'; dash.getColumn(7).numFmt = "0.0%";
  const vo = wb.addWorksheet("Variation Orders", { views: [{ state: "frozen", ySplit: 1 }] });
  vo.columns = [{ header: "VO No.", key: "voNo", width: 12 }, { header: "Supplier", key: "supplier", width: 22 }, { header: "Description", key: "description", width: 52 }, { header: "Amount", key: "amount", width: 18 }, { header: "Currency", key: "currency", width: 12 }, { header: "USD Equivalent", key: "amountUsd", width: 18 }, { header: "Status", key: "status", width: 14 }, { header: "Approved Date", key: "approvedDate", width: 16 }];
  snapshot.variations.forEach((x) => vo.addRow(x)); styleHeader(vo.getRow(1), "FFF07C20"); vo.autoFilter = { from: "A1", to: "H1" }; vo.getColumn(4).numFmt = '#,##0.00;[Red]-#,##0.00'; vo.getColumn(6).numFmt = '#,##0.00;[Red]-#,##0.00';
  const meta = wb.addWorksheet("Control Notes"); meta.addRows([["TAURUS PROJECT CONTROL"], ["Payment Export Control Notes"], ["Source", snapshot.sourceFile], ["Data Date", snapshot.dataDate ?? ""], ["Uploaded By", snapshot.uploadedBy], ["Currency Method", snapshot.currencyNote], ["Confidentiality", "Restricted commercial information"]]); meta.getColumn(1).width = 24; meta.getColumn(2).width = 110; meta.getRow(1).font = { bold: true, size: 16, color: { argb: "FF0B2B4B" } };
  [dash, vo, meta].forEach((s) => { s.eachRow((row) => row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5EE" } } }; cell.alignment = { ...cell.alignment, vertical: "middle", wrapText: true }; })); s.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }; });
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as BodyInit, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="taurus-payment-dashboard-${snapshot.dataDate ?? "export"}.xlsx"`, "Cache-Control": "no-store" } });
}
