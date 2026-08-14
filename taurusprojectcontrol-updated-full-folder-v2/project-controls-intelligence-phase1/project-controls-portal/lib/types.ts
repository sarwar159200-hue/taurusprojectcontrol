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
