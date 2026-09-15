import type { AppRole } from "@/lib/types";

export const adminRoles: AppRole[] = ["super_admin", "project_admin"];

export function isAdminRole(role: AppRole) {
  return adminRoles.includes(role);
}
