import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";
import { adminRoles, isAdminRole } from "@/lib/roles";
import { canAccessSection, defaultPermissionsForRole, normalizePermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { AccessLevel, AppRole, CurrentUser, SectionKey } from "@/lib/types";

export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode) {
    const cookieStore = await cookies();
    if (cookieStore.get("pc_demo_session")?.value !== "active") return null;
    return {
      id: "demo-admin",
      email: process.env.DEMO_ADMIN_EMAIL ?? "admin@example.com",
      username: "admin",
      fullName: "Project Administrator",
      role: "super_admin",
      permissions: defaultPermissionsForRole("super_admin"),
      mustChangePassword: false
    };
  }

  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, username, full_name, role, is_active, section_permissions, must_change_password")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  const role = (profile.role as AppRole | undefined) ?? "viewer";
  return {
    id: claims.sub,
    email: profile.email ?? String(claims.email ?? ""),
    username: profile.username ?? String(claims.email ?? "user").split("@")[0],
    fullName: profile.full_name ?? String(claims.email ?? "User"),
    role,
    permissions: normalizePermissions(profile.section_permissions, role),
    mustChangePassword: Boolean(profile.must_change_password)
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!adminRoles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function requireSection(
  section: SectionKey,
  required: Exclude<AccessLevel, "none"> = "view"
) {
  const user = await requireUser();
  if (!canAccessSection(user, section, required)) redirect(`/dashboard/access-denied?section=${section}`);
  return user;
}

export { isAdminRole };
