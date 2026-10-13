import { normalizePermissions } from "@/lib/permissions";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, ManagedUser } from "@/lib/types";

type ProfileRow = Record<string, any>;

export async function listManagedUsers(): Promise<ManagedUser[]> {
  if (!isSupabaseAdminConfigured) {
    throw new Error("User administration requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in Vercel. This prevents the profiles permission error and allows secure account creation.");
  }

  const supabase = createAdminClient();
  let profiles: ProfileRow[] | null = null;
  let profileError: { message: string } | null = null;

  const presenceQuery = await supabase
    .from("profiles")
    .select("id, email, username, full_name, role, is_active, must_change_password, section_permissions, created_at, last_login_at, last_seen_at")
    .order("created_at", { ascending: true });
  profiles = presenceQuery.data as ProfileRow[] | null;
  profileError = presenceQuery.error;

  // V24 remains usable before migration 0008 is applied; presence simply shows
  // offline until the new column/function are installed.
  if (profileError && /last_seen_at|column/i.test(profileError.message)) {
    const legacyQuery = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role, is_active, must_change_password, section_permissions, created_at, last_login_at")
      .order("created_at", { ascending: true });
    profiles = legacyQuery.data as ProfileRow[] | null;
    profileError = legacyQuery.error;
  }

  if (profileError) throw new Error(profileError.message);
  const onlineCutoff = Date.now() - 90_000;
  return (profiles ?? []).map((profile) => {
    const role = profile.role as AppRole;
    const lastSeenAt = profile.last_seen_at ?? null;
    const seenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
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
      lastLoginAt: profile.last_login_at ?? null,
      lastSeenAt,
      isOnline: Boolean(profile.is_active && seenMs && seenMs >= onlineCutoff)
    };
  });
}
