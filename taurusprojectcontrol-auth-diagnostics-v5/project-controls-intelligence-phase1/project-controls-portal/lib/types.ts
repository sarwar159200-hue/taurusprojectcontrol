export type AppRole =
  | "super_admin"
  | "project_admin"
  | "document_controller"
  | "planner"
  | "viewer";

export type SectionKey =
  | "overview"
  | "document_control"
  | "progress"
  | "schedule"
  | "imports"
  | "user_access"
  | "activity_log";

export type AccessLevel = "none" | "view" | "manage";

export type SectionPermissions = Record<SectionKey, AccessLevel>;

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: AppRole;
  permissions: SectionPermissions;
  mustChangePassword: boolean;
};

export type ManagedUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
  permissions: SectionPermissions;
  createdAt: string;
  lastLoginAt: string | null;
};

export type CurvePoint = {
  date: string;
  baseline: number | null;
  planned: number | null;
  actual: number | null;
};

export type WorkbookPreview = {
  kind: "progress" | "schedule";
  fileName: string;
  fileSize: number;
  valid: boolean;
  title: string;
  summary: Record<string, string | number | null>;
  sheets: Array<{ name: string; rows: number; columns: number }>;
  warnings: string[];
  errors: string[];
  chart?: CurvePoint[];
  distributions?: Record<string, Record<string, number>>;
};

export type DocumentRecordInput = {
  documentNo: string;
  title: string;
  systemDivision: string;
  documentType: string;
  discipline: string;
  subdiscipline: string;
  revision: string;
  purpose: string;
  lastSubmissionDate: string | null;
  lastResponseDate: string | null;
  lastStatus: string;
  currentAction: string;
  reviewCycles: number | null;
  overdueDays: number | null;
  driveWebUrl: string | null;
  sourceRow: number;
};

export type ProgressSeriesPoint = {
  frequency: "monthly" | "weekly";
  area: string;
  discipline: string;
  subdiscipline: string | null;
  measure: "baseline" | "planned" | "actual" | "forecast";
  periodDate: string;
  incrementalValue: number | null;
  cumulativeValue: number | null;
};

export type ScheduleActivityInput = {
  activityId: string;
  activityName: string;
  wbsPath: string;
  discipline: string;
  activityStatus: string;
  activityType: string;
  baselineStart: string | null;
  baselineFinish: string | null;
  currentStart: string | null;
  currentFinish: string | null;
  originalDuration: number | null;
  remainingDuration: number | null;
  totalFloat: number | null;
  schedulePercentComplete: number | null;
  performancePercentComplete: number | null;
  isCritical: boolean;
  sourceRow: number;
};

export type WorkbookAnalysis = WorkbookPreview & {
  documents?: DocumentRecordInput[];
  progressSeries?: ProgressSeriesPoint[];
  scheduleActivities?: ScheduleActivityInput[];
};

export type ProgressAnalysisSnapshot = {
  fileName: string;
  title: string;
  summary: WorkbookPreview["summary"];
  chart: CurvePoint[];
  distributions: Record<string, Record<string, number>>;
  documents: DocumentRecordInput[];
  progressSeries: ProgressSeriesPoint[];
  warnings: string[];
};

export type ScheduleAnalysisSnapshot = {
  fileName: string;
  title: string;
  summary: WorkbookPreview["summary"];
  distributions: Record<string, Record<string, number>>;
  scheduleActivities: ScheduleActivityInput[];
  warnings: string[];
};

export type PublishedProjectUpdate = {
  id: string;
  projectId: string;
  progressFileName: string | null;
  scheduleFileName: string | null;
  dataDate: string | null;
  progressAnalysis: ProgressAnalysisSnapshot | null;
  scheduleAnalysis: ScheduleAnalysisSnapshot | null;
  publishedAt: string;
  publishedBy: string | null;
};
