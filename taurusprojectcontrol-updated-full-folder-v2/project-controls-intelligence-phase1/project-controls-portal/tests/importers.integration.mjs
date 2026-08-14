import { execFileSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  }
});

const python = String.raw`
import json, sys
from datetime import date, datetime, time
from openpyxl import load_workbook

def clean(value):
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    return value

wb = load_workbook(sys.argv[1], data_only=True, read_only=True)
payload = []
for ws in wb.worksheets:
    rows = []
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=ws.max_column, values_only=True):
        rows.append([clean(value) for value in row])
    payload.append({"name": ws.title, "rows": rows, "rowCount": ws.max_row, "columnCount": ws.max_column})
print(json.dumps(payload, ensure_ascii=False))
`;

class MockCell {
  constructor(value) { this.value = value; }
}
class MockRow {
  constructor(values) { this.values = values; }
  getCell(column) { return new MockCell(this.values[column - 1] ?? null); }
  eachCell(options, callback) {
    this.values.forEach((value, index) => {
      if (options?.includeEmpty || (value !== null && value !== undefined && value !== "")) {
        callback(new MockCell(value), index + 1);
      }
    });
  }
}
class MockSheet {
  constructor(source) {
    this.name = source.name;
    this.rows = source.rows;
    this.rowCount = source.rowCount;
    this.columnCount = source.columnCount;
  }
  getRow(row) { return new MockRow(this.rows[row - 1] ?? []); }
  getCell(row, column) { return this.getRow(row).getCell(column); }
}
class MockWorkbook {
  constructor(sheets) { this.worksheets = sheets.map((sheet) => new MockSheet(sheet)); }
}

function loadWorkbook(path) {
  const output = execFileSync("python", ["-c", python, path], { maxBuffer: 20 * 1024 * 1024 });
  return new MockWorkbook(JSON.parse(output.toString("utf8")));
}

const importerUrl = pathToFileURL(new URL("../lib/importers/detect-workbook.ts", import.meta.url).pathname).href;
const { detectAndImportWorkbook } = await import(importerUrl);
const [progressPath, schedulePath] = process.argv.slice(2);
assert(progressPath && schedulePath, "Pass progress and schedule workbook paths.");

const progress = detectAndImportWorkbook(loadWorkbook(progressPath), "progress.xlsx", 1);
assert.equal(progress.kind, "progress");
assert.equal(progress.valid, true);
assert.equal(progress.summary.documents, 914);
assert.equal(progress.summary.approved, 719);
assert.equal(progress.summary.approvedWithComments, 65);
assert.equal(progress.summary.underReview, 31);
assert.equal(progress.summary.dataDate, "2026-06-01T00:00:00");
assert.equal(progress.summary.actual, 34.82);
assert.equal(progress.summary.planned, 36.13);

const schedule = detectAndImportWorkbook(loadWorkbook(schedulePath), "schedule.xlsx", 1);
assert.equal(schedule.kind, "schedule");
assert.equal(schedule.valid, true);
assert.equal(schedule.summary.activities, 2709);
assert.equal(schedule.summary.summaryRows, 554);
assert.equal(schedule.summary.critical, 35);

console.log(JSON.stringify({ progress: progress.summary, schedule: schedule.summary }, null, 2));
