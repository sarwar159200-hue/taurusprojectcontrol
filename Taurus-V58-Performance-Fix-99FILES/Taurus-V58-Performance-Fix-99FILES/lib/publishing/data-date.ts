import type { ProgressAnalysisSnapshot, ScheduleAnalysisSnapshot } from "@/lib/types";

/**
 * The Project Schedule is the governing source for the portal Data Date.
 * Progress/MDR is used only until a schedule workbook has been published.
 */
export function resolvePublishedDataDate(
  progress: ProgressAnalysisSnapshot | null,
  schedule: ScheduleAnalysisSnapshot | null
) {
  const scheduleDataDate = String(schedule?.summary.dataDate ?? "").trim();
  if (scheduleDataDate) return scheduleDataDate;
  const progressDataDate = String(progress?.summary.dataDate ?? "").trim();
  return progressDataDate || null;
}
