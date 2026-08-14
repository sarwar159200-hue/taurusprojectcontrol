import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";
import { adminRoles, isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, CurrentUser } from "@/lib/types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode) {
    const cookieStore = await cookies();
    if (cookieStore.get("pc_demo_session")?.value !== "active") return null;
    return {
      id: "demo-admin",
      email: process.env.DEMO_ADMIN_EMAIL ?? "admin@example.com",
      username: "admin",
      fullName: "Project Administrator",
      role: "super_admin"
    };
  }

  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, username, full_name, role, is_active")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return {
    id: claims.sub,
    email: profile.email ?? String(claims.email ?? ""),
    username: profile.username ?? String(claims.email ?? "user").split("@")[0],
    fullName: profile.full_name ?? String(claims.email ?? "User"),
    role: (profile.role as AppRole | undefined) ?? "viewer"
  };
}

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

export { isAdminRole };
