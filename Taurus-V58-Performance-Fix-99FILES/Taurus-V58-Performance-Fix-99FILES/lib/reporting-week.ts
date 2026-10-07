const DAY_MS = 86_400_000;
const REPORTING_WEEK_ANCHOR_DATE = Date.parse("2026-02-05T00:00:00Z");
const REPORTING_WEEK_ANCHOR_NUMBER = 32;

/** Project reporting week sequence defined by the weekly Excel workbook. */
export function projectReportingWeek(dateString: string) {
  const reportingDate = Date.parse(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(reportingDate)) return null;
  const weekOffset = Math.round((reportingDate - REPORTING_WEEK_ANCHOR_DATE) / (7 * DAY_MS));
  return REPORTING_WEEK_ANCHOR_NUMBER + weekOffset;
}
