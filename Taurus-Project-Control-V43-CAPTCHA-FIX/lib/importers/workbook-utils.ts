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
  if (typeof value === "number" && Number.isFinite(value) && value >= 20_000 && value <= 100_000) {
    // Formula-backed Excel dates are returned by ExcelJS as serial numbers.
    // Excel's 1900 date system is represented safely with the 1899-12-30 UTC
    // epoch so the calendar day never shifts with the Vercel server timezone.
    const parsed = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string" && value.trim()) {
    const text = value.trim().replace(/\s+[A-Z]$/i, "");
    const calendarDate = text.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
    if (calendarDate) return calendarDate[1];

    // P6 Excel exports commonly use values such as "01-May-25 A". Parse
    // those date-only strings explicitly so a server timezone can never move
    // the activity to the previous or following calendar day.
    const namedMonth = text.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2}|\d{4})$/);
    if (namedMonth) {
      const months: Record<string, number> = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
        apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
        aug: 8, august: 8, sep: 9, sept: 9, september: 9,
        oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
      };
      const month = months[namedMonth[2].toLowerCase()];
      const shortYear = Number(namedMonth[3]);
      const year = namedMonth[3].length === 2 ? 2000 + shortYear : shortYear;
      if (month && year >= 1900) {
        return `${year}-${String(month).padStart(2, "0")}-${String(Number(namedMonth[1])).padStart(2, "0")}`;
      }
    }

    const numericDate = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (numericDate) {
      const shortYear = Number(numericDate[3]);
      const year = numericDate[3].length === 2 ? 2000 + shortYear : shortYear;
      return `${year}-${String(Number(numericDate[2])).padStart(2, "0")}-${String(Number(numericDate[1])).padStart(2, "0")}`;
    }

    const parsed = new Date(`${text} UTC`);
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

export function headerColumns(sheet: Worksheet): Map<string, number> {
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const header = normalize(textOf(cell));
    if (header) headers.set(header, column);
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
