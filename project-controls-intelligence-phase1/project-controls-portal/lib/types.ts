export type AppRole =
  | "super_admin"
  | "project_admin"
  | "document_controller"
  | "planner"
  | "viewer";

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: AppRole;
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
