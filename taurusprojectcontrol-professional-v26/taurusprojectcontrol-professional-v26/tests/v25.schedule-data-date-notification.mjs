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

const schedulePath = process.argv[2];
assert(schedulePath, "Pass the Project Schedule XLSX path.");

const importerUrl = pathToFileURL(new URL("../lib/importers/schedule-workbook.ts", import.meta.url).pathname).href;
const { importScheduleWorkbook } = await import(importerUrl);
const emailUrl = pathToFileURL(new URL("../lib/notifications/project-update-email.ts", import.meta.url).pathname).href;
const { buildProjectUpdateEmail } = await import(emailUrl);
const dataDateUrl = pathToFileURL(new URL("../lib/publishing/data-date.ts", import.meta.url).pathname).href;
const { resolvePublishedDataDate } = await import(dataDateUrl);

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(schedulePath);
const schedule = importScheduleWorkbook(workbook, "Project Schedule-Taurus.xlsx", 1);

assert.equal(schedule.valid, true);
assert.equal(schedule.summary.activities, 2709);
assert.equal(schedule.summary.dataDate, "2026-08-22");
assert.equal(schedule.summary.dataDateSource, "Project Schedule / Data Date");
assert.equal(resolvePublishedDataDate(
  { summary: { dataDate: "2026-06-01" } },
  { summary: { dataDate: "2026-08-22" } }
), "2026-08-22");

const limitedNtp = schedule.scheduleActivities.find((row) => row.activityId.trim() === "MS-1001");
assert(limitedNtp, "MS-1001 should be imported.");
assert.equal(limitedNtp.currentStart, "2025-05-01");

for (const activity of schedule.scheduleActivities) {
  for (const value of [activity.baselineStart, activity.baselineFinish, activity.currentStart, activity.currentFinish]) {
    if (value) assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
  }
}

const email = buildProjectUpdateEmail({
  administratorName: "Sarwar Khalid",
  dashboardUrl: "https://taurusprojectcontrol.vercel.app/dashboard",
  dataDate: "2026-08-22"
});
assert.match(email.subject, /dashboard updated/i);
assert.match(email.text, /Sarwar Khalid/);
assert.match(email.text, /22 Aug 2026/);
assert.match(email.html, /Open Project Control Dashboard/);

console.log(JSON.stringify({
  activities: schedule.summary.activities,
  dataDate: schedule.summary.dataDate,
  firstControlledDate: limitedNtp.currentStart,
  emailSubject: email.subject
}, null, 2));
