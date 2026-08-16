import type {
  AccessLevel,
  AppRole,
  CurrentUser,
  SectionKey,
  SectionPermissions
} from "@/lib/types";

export const sectionDefinitions: Array<{ key: SectionKey; label: string; description: string }> = [
  { key: "overview", label: "Executive overview", description: "Project KPIs and management summary" },
  { key: "document_control", label: "Document control", description: "MDR, status, overdue data and links" },
  { key: "progress", label: "Progress & S-curves", description: "Monthly, weekly and discipline progress" },
  { key: "schedule", label: "Project schedule", description: "WBS, Gantt, milestones and criticality" },
  { key: "imports", label: "Import & publish", description: "Upload, validate and publish controlled updates" },
  { key: "user_access", label: "User access", description: "Create, edit and remove user accounts" },
  { key: "activity_log", label: "Activity log", description: "Review logins, page access and administration" }
];

const rank: Record<AccessLevel, number> = { none: 0, view: 1, manage: 2 };

const all = (level: AccessLevel): SectionPermissions => ({
  overview: level,
  document_control: level,
  progress: level,
  schedule: level,
  imports: level,
  user_access: level,
  activity_log: level
});

export function defaultPermissionsForRole(role: AppRole): SectionPermissions {
  if (role === "super_admin") return all("manage");
  if (role === "project_admin") {
    return {
      overview: "manage",
      document_control: "manage",
      progress: "manage",
      schedule: "manage",
      imports: "manage",
      user_access: "view",
      activity_log: "view"
    };
  }
  if (role === "document_controller") {
    return {
      overview: "view",
      document_control: "manage",
      progress: "view",
      schedule: "view",
      imports: "manage",
      user_access: "none",
      activity_log: "none"
    };
  }
  if (role === "planner") {
    return {
      overview: "view",
      document_control: "view",
      progress: "manage",
      schedule: "manage",
      imports: "manage",
      user_access: "none",
      activity_log: "none"
    };
  }
  return {
    overview: "view",
    document_control: "view",
    progress: "view",
    schedule: "view",
    imports: "none",
    user_access: "none",
    activity_log: "none"
  };
}

export function normalizePermissions(value: unknown, role: AppRole): SectionPermissions {
  if (role === "super_admin") return all("manage");
  const defaults = defaultPermissionsForRole(role);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(
    sectionDefinitions.map(({ key }) => {
      const access = candidate[key];
      return [key, access === "none" || access === "view" || access === "manage" ? access : defaults[key]];
    })
  ) as SectionPermissions;
}

export function canAccessSection(
  user: Pick<CurrentUser, "role" | "permissions">,
  section: SectionKey,
  required: Exclude<AccessLevel, "none"> = "view"
) {
  if (user.role === "super_admin") return true;
  return rank[user.permissions[section]] >= rank[required];
}
