import type { Workbook } from "exceljs";
import type { WorkbookPreview } from "../types";
import { importProgressWorkbook } from "./progress-workbook";
import { importScheduleWorkbook } from "./schedule-workbook";
import { headerSet, normalize } from "./workbook-utils";

export function detectAndImportWorkbook(
  workbook: Workbook,
  fileName: string,
  fileSize: number
): WorkbookPreview {
  const sheetNames = new Set(workbook.worksheets.map((sheet) => normalize(sheet.name)));
  if (sheetNames.has("mdr") && sheetNames.has("overall monthly s-curve")) {
    return importProgressWorkbook(workbook, fileName, fileSize);
  }

  const first = workbook.worksheets[0];
  const headers = first ? headerSet(first) : new Set<string>();
  if (headers.has("activity id") && headers.has("activity name")) {
    return importScheduleWorkbook(workbook, fileName, fileSize);
  }

  return {
    kind: "progress",
    fileName,
    fileSize,
    valid: false,
    title: "Unrecognized Workbook",
    summary: {},
    sheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rowCount,
      columns: sheet.columnCount
    })),
    warnings: [],
    errors: [
      "The workbook was not recognized. Upload either the progress/MDR workbook or the 17-column schedule export."
    ]
  };
}
