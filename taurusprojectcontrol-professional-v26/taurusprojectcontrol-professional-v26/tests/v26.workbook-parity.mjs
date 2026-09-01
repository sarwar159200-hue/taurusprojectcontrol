import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import ExcelJS from "exceljs";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith(".ts") && (specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  }
});

const workbookPath = process.argv[2];
assert(workbookPath, "Pass the progress/MDR workbook path.");
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);

const importerUrl = pathToFileURL(new URL("../lib/importers/detect-workbook.ts", import.meta.url).pathname).href;
const reportingWeekUrl = pathToFileURL(new URL("../lib/reporting-week.ts", import.meta.url).pathname).href;
const utilsUrl = pathToFileURL(new URL("../lib/importers/workbook-utils.ts", import.meta.url).pathname).href;
const { detectAndImportWorkbook } = await import(importerUrl);
const { projectReportingWeek } = await import(reportingWeekUrl);
const { dateOf, numberOf } = await import(utilsUrl);

const analysis = detectAndImportWorkbook(workbook, "progress.xlsx", 1);
assert.equal(analysis.valid, true);
const series = analysis.progressSeries ?? [];

function point(frequency, discipline, subdiscipline, measure, date) {
  const result = series.find((row) => row.frequency === frequency
    && row.discipline === discipline
    && row.subdiscipline === subdiscipline
    && row.measure === measure
    && row.periodDate === date);
  assert(result, `Missing ${frequency}/${discipline}/${subdiscipline ?? "Total"}/${measure}/${date}`);
  return result;
}

function close(actual, expected, label) {
  assert(actual !== null && expected !== null, `${label} must be numeric.`);
  assert(Math.abs(actual - expected) < 1e-12, `${label}: ${actual} does not match ${expected}`);
}

const weeklyDisciplines = new Set(series.filter((row) => row.frequency === "weekly").map((row) => row.discipline));
assert.deepEqual(weeklyDisciplines, new Set(["Construction", "Engineering"]));
assert(!series.some((row) => row.measure === "planned"), "Dashboard series must use baseline and actual only.");
assert.equal(projectReportingWeek("2026-02-05"), 32);

const weeklyConstruction = workbook.getWorksheet("Weekly Construction");
assert(weeklyConstruction);
const constructionDate = dateOf(weeklyConstruction.getRow(1).getCell(2));
assert.equal(constructionDate, "2026-02-05");
close(point("weekly", "Construction", null, "baseline", constructionDate).cumulativeValue, numberOf(weeklyConstruction.getRow(17).getCell(2)), "Weekly Construction baseline total");
close(point("weekly", "Construction", null, "actual", constructionDate).cumulativeValue, numberOf(weeklyConstruction.getRow(35).getCell(2)), "Weekly Construction actual total");

const monthlyConstruction = workbook.getWorksheet("Construction Monthly");
assert(monthlyConstruction);
let earthworksSeed = 0;
for (let column = 2; column <= monthlyConstruction.columnCount; column += 1) {
  const date = dateOf(monthlyConstruction.getRow(37).getCell(column));
  const value = numberOf(monthlyConstruction.getRow(38).getCell(column));
  if (date && date < constructionDate && value !== null) earthworksSeed += value;
}
const earthworksIncrement = numberOf(weeklyConstruction.getRow(20).getCell(2));
close(point("weekly", "Construction", "Earthworks", "actual", constructionDate).cumulativeValue, earthworksSeed + (earthworksIncrement ?? 0), "Weekly Earthworks cumulative");

const weeklyEngineering = workbook.getWorksheet("Weekly Engineering");
assert(weeklyEngineering);
const engineeringDate = dateOf(weeklyEngineering.getRow(1).getCell(5));
assert.equal(engineeringDate, "2026-02-05");
close(point("weekly", "Engineering", null, "baseline", engineeringDate).cumulativeValue, numberOf(weeklyEngineering.getRow(9).getCell(5)), "Weekly Engineering baseline total");
close(point("weekly", "Engineering", "Plant Design", "baseline", engineeringDate).cumulativeValue, numberOf(weeklyEngineering.getRow(2).getCell(5)), "Weekly Plant Design baseline");

const engineeringSubs = new Set(series.filter((row) => row.frequency === "weekly" && row.discipline === "Engineering" && row.subdiscipline).map((row) => row.subdiscipline));
assert.deepEqual(engineeringSubs, new Set(["Plant Design", "Architecture & Civil", "Electrical", "I&C", "Process", "Mechanical"]));
const constructionSubs = new Set(series.filter((row) => row.frequency === "weekly" && row.discipline === "Construction" && row.subdiscipline).map((row) => row.subdiscipline));
assert.deepEqual(constructionSubs, new Set([
  "Earthworks", "Civil Works", "Steel Erection", "Architectural", "Piping Works", "Electrical Works", "I&C Works",
  "Mechanical Equipment", "ST & GT Erection Works", "H.V.A.C Works", "Fire Fighting Works", "Heat Insulation Works",
  "Painting & Coating Works", "Start-Up"
]));

console.log(JSON.stringify({
  summary: analysis.summary,
  progressPoints: series.length,
  weeklyDisciplines: [...weeklyDisciplines],
  weeklyEngineeringCurves: engineeringSubs.size + 1,
  weeklyConstructionCurves: constructionSubs.size + 1,
  reportingWeekAnchor: "2026-02-05 = W32"
}, null, 2));
