import type { Cell, Worksheet, Workbook } from "exceljs";

export function valueOf(cell: Cell): unknown {
  const value = cell.value as unknown;
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || value instanceof Date) return value;

  const record = value as Record<string, unknown>;
  if ("result" in record) return record.result ?? null;
  if ("richText" in record && Array.isArray(record.richText)) {
    return record.richText
      .map((part) => (part as { text?: string }).text ?? "")
      .join("");
  }
  if ("text" in record) return record.text ?? null;
  if ("hyperlink" in record) return record.hyperlink ?? null;
  return String(value);
}

export function textOf(cell: Cell): string {
  const value = valueOf(cell);
  return value === null ? "" : String(value).trim();
}

export function numberOf(cell: Cell): number | null {
  const value = valueOf(cell);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[% ,]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return value.includes("%") ? parsed / 100 : parsed;
  }
  return null;
}

export function dateOf(cell: Cell): string | null {
  const value = valueOf(cell);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string" && value.trim()) {
    const text = value.trim().replace(/\s+[A-Z]$/i, "");
    const calendarDate = text.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
    if (calendarDate) return calendarDate[1];
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const day = String(parsed.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return text;
  }
  return null;
}

export function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function headerSet(sheet: Worksheet): Set<string> {
  const headers = new Set<string>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    const header = normalize(textOf(cell));
    if (header) headers.add(header);
  });
  return headers;
}

export function sheetStats(workbook: Workbook) {
  return workbook.worksheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rowCount,
    columns: sheet.columnCount
  }));
}

export function increment(target: Record<string, number>, key: string) {
  const label = key.trim() || "Unspecified";
  target[label] = (target[label] ?? 0) + 1;
}
