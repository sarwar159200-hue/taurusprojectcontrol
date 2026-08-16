import { execFileSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.endsWith(".ts") &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !/\.[a-z]+$/i.test(specifier)
    ) {
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
const publisherUrl = pathToFileURL(new URL("../lib/publishing/versioned-publisher.ts", import.meta.url).pathname).href;
const { compactProgressAnalysis, compactScheduleAnalysis } = await import(publisherUrl);
const [progressPath, schedulePath] = process.argv.slice(2);
assert(progressPath && schedulePath, "Pass progress and schedule workbook paths.");

const progress = detectAndImportWorkbook(loadWorkbook(progressPath), "progress.xlsx", 1);
assert.equal(progress.kind, "progress");
assert.equal(progress.valid, true);
assert.equal(progress.summary.documents, 914);
assert.equal(progress.summary.approved, 719);
assert.equal(progress.summary.approvedWithComments, 65);
assert.equal(progress.summary.underReview, 31);
assert.equal(progress.summary.dataDate, "2026-06-01");
assert.equal(progress.summary.actual, 34.82);
assert.equal(progress.summary.planned, 36.13);
assert(progress.progressSeries.some((point) => point.area === "Engineering" && point.subdiscipline === "Plant Design"));
assert(progress.progressSeries.some((point) => point.area === "Construction" && point.subdiscipline === "Civil Works" && point.measure === "planned"));
assert(progress.progressSeries.some((point) => point.area === "Engineering" && point.frequency === "weekly"));
assert(progress.progressSeries.some((point) => point.area === "Procurement" && point.subdiscipline === "Key Equipment"));
assert.equal(new Set(progress.documents.map((row) => row.documentNo)).size, progress.documents.length);
assert.equal(new Set(progress.progressSeries.map((row) => [row.frequency, row.area, row.discipline, row.subdiscipline ?? "", row.measure, row.periodDate].join("|"))).size, progress.progressSeries.length);

const monthlyDisciplines = new Set(progress.progressSeries
  .filter((point) => point.frequency === "monthly")
  .map((point) => point.discipline));
assert.deepEqual(monthlyDisciplines, new Set(["Overall", "Engineering", "Procurement", "Construction", "Mobilization"]));

function subdisciplines(frequency, discipline) {
  return [...new Set(progress.progressSeries
    .filter((point) => point.frequency === frequency && point.discipline === discipline)
    .map((point) => point.subdiscipline)
    .filter(Boolean))];
}

assert.deepEqual(subdisciplines("monthly", "Engineering"), [
  "Plant Design", "Architecture & Civil", "Electrical", "I&C", "Process", "Mechanical"
]);
assert.deepEqual(subdisciplines("monthly", "Procurement"), [
  "Key Equipment", "Civil", "Electrical", "Instrumentation Control", "Mechanical", "PD"
]);
assert.deepEqual(subdisciplines("monthly", "Construction"), [
  "Earthworks", "Civil Works", "Steel Erection", "Architectural", "Piping Works", "E&I Works",
  "Mechanical Equipment", "ST & GT Erection Works", "H.V.A.C Works", "Fire Fighting Works",
  "Heat Insulation Works", "Painting & Coating Works", "Start-Up"
]);
assert.deepEqual(subdisciplines("weekly", "Engineering"), subdisciplines("monthly", "Engineering"));
assert.deepEqual(subdisciplines("weekly", "Construction"), subdisciplines("monthly", "Construction"));

// ExcelJS is used in the Vercel route. Future zero placeholders must not move
// the actual reporting point or SPI beyond the last achieved period.
const productionWorkbook = new ExcelJS.Workbook();
await productionWorkbook.xlsx.readFile(progressPath);
const productionProgress = detectAndImportWorkbook(productionWorkbook, "progress.xlsx", 1);
assert.equal(productionProgress.summary.dataDate, "2026-06-01");
assert.equal(productionProgress.summary.actual, 34.82);
assert.equal(productionProgress.summary.planned, 36.13);
assert.equal(productionProgress.summary.spi, 0.964);
assert.equal(productionProgress.chart.filter((point) => point.actual !== null).at(-1).date, "2026-06-01");

const schedule = detectAndImportWorkbook(loadWorkbook(schedulePath), "schedule.xlsx", 1);
assert.equal(schedule.kind, "schedule");
assert.equal(schedule.valid, true);
assert.equal(schedule.summary.activities, 2709);
assert.equal(schedule.summary.summaryRows, 554);
assert.equal(schedule.summary.critical, 35);
assert(schedule.scheduleActivities.some((activity) => activity.discipline === "Engineering" && activity.subdiscipline === "PLANT DESIGN"));
assert(schedule.scheduleActivities.some((activity) => activity.discipline === "Construction" && activity.subdiscipline === "CIVIL"));
assert.equal(new Set(schedule.scheduleActivities.map((row) => row.activityId)).size, schedule.scheduleActivities.length);

const compactProgress = compactProgressAnalysis(progress);
const compactSchedule = compactScheduleAnalysis(schedule);
assert.deepEqual(compactProgress.documents, []);
assert.deepEqual(compactProgress.progressSeries, []);
assert.deepEqual(compactSchedule.scheduleActivities, []);
assert(Buffer.byteLength(JSON.stringify(compactProgress)) < 100_000);
assert(Buffer.byteLength(JSON.stringify(compactSchedule)) < 100_000);

console.log(JSON.stringify({
  progress: progress.summary,
  schedule: schedule.summary,
  payloadBytes: {
    progress: Buffer.byteLength(JSON.stringify(progress)),
    schedule: Buffer.byteLength(JSON.stringify(schedule)),
    combined: Buffer.byteLength(JSON.stringify({ progress, schedule })),
    documents: Buffer.byteLength(JSON.stringify(progress.documents)),
    progressSeries: Buffer.byteLength(JSON.stringify(progress.progressSeries)),
    scheduleActivities: Buffer.byteLength(JSON.stringify(schedule.scheduleActivities))
  }
}, null, 2));
