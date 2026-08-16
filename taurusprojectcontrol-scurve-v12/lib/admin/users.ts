import { normalizePermissions } from "@/lib/permissions";
import { createAuthorizedDataClient } from "@/lib/supabase/data";
import type { AppRole, ManagedUser } from "@/lib/types";

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const supabase = await createAuthorizedDataClient();
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, username, full_name, role, is_active, must_change_password, section_permissions, created_at, last_login_at")
    .order("created_at", { ascending: true });

  if (profileError) throw new Error(profileError.message);
  return (profiles ?? []).map((profile) => {
    const role = profile.role as AppRole;
    return {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      fullName: profile.full_name,
      role,
      isActive: Boolean(profile.is_active),
      mustChangePassword: Boolean(profile.must_change_password),
      permissions: normalizePermissions(profile.section_permissions, role),
      createdAt: profile.created_at,
      lastLoginAt: profile.last_login_at ?? null
    };
  });
}
