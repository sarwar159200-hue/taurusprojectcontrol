import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePermissions } from "@/lib/permissions";
import type { AppRole, ManagedUser } from "@/lib/types";

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();
  const [{ data: profiles, error: profileError }, authResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, username, full_name, role, is_active, must_change_password, section_permissions, created_at, last_login_at")
      .order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);

  if (profileError) throw new Error(profileError.message);
  if (authResult.error) throw new Error(authResult.error.message);

  const authUsers = new Map(authResult.data.users.map((user) => [user.id, user]));
  return (profiles ?? []).map((profile) => {
    const role = profile.role as AppRole;
    const authUser = authUsers.get(profile.id);
    return {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      fullName: profile.full_name,
      role,
      isActive: Boolean(profile.is_active) && Boolean(authUser) && !authUser?.banned_until,
      mustChangePassword: Boolean(profile.must_change_password),
      permissions: normalizePermissions(profile.section_permissions, role),
      createdAt: profile.created_at,
      lastLoginAt: authUser?.last_sign_in_at ?? profile.last_login_at ?? null
    };
  });
}
