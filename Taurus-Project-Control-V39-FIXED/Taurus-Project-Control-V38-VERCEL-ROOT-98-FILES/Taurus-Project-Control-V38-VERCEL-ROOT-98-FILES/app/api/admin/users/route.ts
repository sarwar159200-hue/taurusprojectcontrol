import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection, normalizePermissions } from "@/lib/permissions";
import { getDefaultProjectId } from "@/lib/project";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient, friendlyAdminError } from "@/lib/supabase/admin";
import type { AppRole, SectionPermissions } from "@/lib/types";

const allowedRoles: AppRole[] = [
  "super_admin",
  "project_admin",
  "document_controller",
  "planner",
  "viewer"
];

type CreateUserBody = {
  email?: string;
  username?: string;
  fullName?: string;
  role?: AppRole;
  temporaryPassword?: string;
  permissions?: SectionPermissions;
};

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!canAccessSection(actor, "user_access", "manage")) {
    return NextResponse.json({ error: "User-management permission is required." }, { status: 403 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const projectId = getDefaultProjectId();
  if (!projectId) {
    return NextResponse.json({ error: "DEFAULT_PROJECT_ID is not configured in Vercel." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as CreateUserBody | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const username = body?.username?.trim().toLowerCase() ?? "";
  const fullName = body?.fullName?.trim() ?? "";
  const temporaryPassword = body?.temporaryPassword ?? "";
  const role = body?.role ?? "viewer";

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return NextResponse.json({ error: "Username must contain 3–40 letters, numbers, dots, underscores or hyphens." }, { status: 400 });
  }
  if (fullName.length < 2 || fullName.length > 100) {
    return NextResponse.json({ error: "Enter the user's full name." }, { status: 400 });
  }
  if (
    temporaryPassword.length < 12 ||
    !/[A-Z]/.test(temporaryPassword) ||
    !/[a-z]/.test(temporaryPassword) ||
    !/[0-9]/.test(temporaryPassword) ||
    !/[^A-Za-z0-9]/.test(temporaryPassword)
  ) {
    return NextResponse.json({ error: "Temporary password must contain 12+ characters, including uppercase, lowercase, number and symbol." }, { status: 400 });
  }
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (role === "super_admin" && actor.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super administrator can create another super administrator." }, { status: 403 });
  }

  const permissions = normalizePermissions(body?.permissions, role);
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: friendlyAdminError(error) }, { status: 503 });
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password: temporaryPassword, email_confirm: true,
    user_metadata: { username, full_name: fullName }
  });
  if (error || !data.user) {
    return NextResponse.json({ error: friendlyAdminError(error ?? new Error("The account could not be created.")) }, { status: 400 });
  }

  const userId = data.user.id;
  const supabase = admin;
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    email,
    username,
    full_name: fullName,
    role,
    is_active: true,
    must_change_password: true,
    section_permissions: permissions
  }, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 409 });
  }

  const { error: membershipError } = await supabase.from("project_members").upsert({
    project_id: projectId,
    user_id: userId,
    role
  });
  if (membershipError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: membershipError.message }, { status: 409 });
  }

  await supabase.from("audit_log").insert({
    actor_id: actor.id,
    event_type: "user.created",
    entity_type: "profile",
    entity_id: userId,
    project_id: projectId,
    details: { email, username, role, permissions, temporary_password: "issued" }
  });

  return NextResponse.json({ ok: true, id: userId });
}
