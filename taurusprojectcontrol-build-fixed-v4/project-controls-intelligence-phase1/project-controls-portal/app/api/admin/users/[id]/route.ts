import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSection, normalizePermissions } from "@/lib/permissions";
import { getDefaultProjectId } from "@/lib/project";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, CurrentUser, SectionPermissions } from "@/lib/types";

const allowedRoles: AppRole[] = [
  "super_admin",
  "project_admin",
  "document_controller",
  "planner",
  "viewer"
];

type UpdateUserBody = {
  username?: string;
  fullName?: string;
  role?: AppRole;
  permissions?: SectionPermissions;
  temporaryPassword?: string;
};

type Authorization =
  | { ok: true; actor: CurrentUser }
  | { ok: false; response: NextResponse };

async function authorize(): Promise<Authorization> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!canAccessSection(actor, "user_access", "manage")) {
    return { ok: false, response: NextResponse.json({ error: "User-management permission is required." }, { status: 403 }) };
  }
  if (!isSupabaseAdminConfigured) {
    return { ok: false, response: NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 }) };
  }
  return { ok: true, actor };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorize();
  if (!authorization.ok) return authorization.response;
  const actor = authorization.actor;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateUserBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, email, role, must_change_password")
    .eq("id", id)
    .maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (id === actor.id) {
    return NextResponse.json({ error: "You cannot modify your own role or permissions from User Access." }, { status: 400 });
  }
  if (target.role === "super_admin" && actor.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super administrator can modify a super administrator." }, { status: 403 });
  }

  const role = body.role ?? (target.role as AppRole);
  if (!allowedRoles.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  if (role === "super_admin" && actor.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super administrator can assign that role." }, { status: 403 });
  }
  const username = body.username?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) {
    return NextResponse.json({ error: "Enter a valid username." }, { status: 400 });
  }
  if (fullName !== undefined && (fullName.length < 2 || fullName.length > 100)) {
    return NextResponse.json({ error: "Enter a valid full name." }, { status: 400 });
  }
  if (body.temporaryPassword && (
    body.temporaryPassword.length < 12 ||
    !/[A-Z]/.test(body.temporaryPassword) ||
    !/[a-z]/.test(body.temporaryPassword) ||
    !/[0-9]/.test(body.temporaryPassword) ||
    !/[^A-Za-z0-9]/.test(body.temporaryPassword)
  )) {
    return NextResponse.json({ error: "Temporary password must contain 12+ characters, including uppercase, lowercase, number and symbol." }, { status: 400 });
  }

  const permissions = normalizePermissions(body.permissions, role);
  if (body.temporaryPassword) {
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.temporaryPassword });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    role,
    section_permissions: permissions
  };
  if (body.temporaryPassword) update.must_change_password = true;
  if (username) update.username = username;
  if (fullName !== undefined) update.full_name = fullName;

  const { error: profileError } = await admin.from("profiles").update(update).eq("id", id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 409 });

  const projectId = getDefaultProjectId();
  if (projectId) {
    await admin.from("project_members").upsert({ project_id: projectId, user_id: id, role });
    await admin.from("audit_log").insert({
      actor_id: actor.id,
      event_type: body.temporaryPassword ? "user.temporary_password_reset" : "user.permissions_updated",
      entity_type: "profile",
      entity_id: id,
      project_id: projectId,
      details: { email: target.email, role, permissions }
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await authorize();
  if (!authorization.ok) return authorization.response;
  const actor = authorization.actor;
  const { id } = await context.params;
  if (id === actor.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("email, role")
    .eq("id", id)
    .maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "super_admin") {
    return NextResponse.json({ error: "A super-administrator account cannot be removed from the portal." }, { status: 403 });
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const projectId = getDefaultProjectId();
  await admin.from("audit_log").insert({
    actor_id: actor.id,
    event_type: "user.deleted",
    entity_type: "profile",
    entity_id: id,
    project_id: projectId,
    details: { email: target.email, former_role: target.role }
  });
  return NextResponse.json({ ok: true });
}
