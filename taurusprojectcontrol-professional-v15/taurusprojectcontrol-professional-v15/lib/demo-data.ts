import type { CurvePoint } from "@/lib/types";

export const dashboardMetrics = {
  dataDate: "01-Jun-2026",
  actual: 34.82,
  planned: 36.13,
  baseline: 33.49,
  spi: 1.04,
  sv: 1.32,
  expectedFinish: "26-Dec-2027",
  baselineFinish: "01-Feb-2028",
  finishVarianceDays: -37,
  totalDocuments: 914,
  approved: 719,
  approvedWithComments: 65,
  underReview: 31,
  reviseResubmit: 98,
  criticalActivities: 35,
  scheduleActivities: 2709,
  scheduleRows: 3263
};

export const disciplineDistribution: Record<string, number> = {
  Civil: 405,
  Mechanical: 240,
  Electrical: 98,
  "I&C": 58,
  "QA/QC": 48,
  HSE: 45,
  General: 10,
  "Project Management": 5,
  "Project Progress & Control": 5
};

export const actionDistribution: Record<string, number> = {
  "Final document": 719,
  "ENKA action": 163,
  "Taurus action": 31,
  "On hold": 1
};

export const overviewCurve: CurvePoint[] = [
  { date: "2025-06-01", baseline: 0, planned: 0, actual: 0 },
  { date: "2025-07-01", baseline: 0.0956, planned: 0.0971, actual: 0.0971 },
  { date: "2025-08-01", baseline: 0.1366, planned: 0.1387, actual: 0.1387 },
  { date: "2025-09-01", baseline: 0.1434, planned: 0.1499, actual: 0.1499 },
  { date: "2025-10-01", baseline: 0.1559, planned: 0.1631, actual: 0.1631 },
  { date: "2025-11-01", baseline: 0.1655, planned: 0.1783, actual: 0.1783 },
  { date: "2025-12-01", baseline: 0.1775, planned: 0.1935, actual: 0.1935 },
  { date: "2026-01-01", baseline: 0.1904, planned: 0.2065, actual: 0.2065 },
  { date: "2026-02-01", baseline: 0.2089, planned: 0.2288, actual: 0.2288 },
  { date: "2026-03-01", baseline: 0.2306, planned: 0.2437, actual: 0.2437 },
  { date: "2026-04-01", baseline: 0.2553, planned: 0.2652, actual: 0.2652 },
  { date: "2026-05-01", baseline: 0.3038, planned: 0.3211, actual: 0.3198 },
  { date: "2026-06-01", baseline: 0.3349, planned: 0.3613, actual: 0.3482 }
];

export const scheduleStatus = {
  Completed: 650,
  "In Progress": 208,
  "Not Started": 1851
};
