import { NextResponse } from "next/server";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/types";

const allowedRoles: AppRole[] = [
  "super_admin",
  "project_admin",
  "document_controller",
  "planner",
  "viewer"
];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const projectId = process.env.DEFAULT_PROJECT_ID;
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "The default project ID is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; username?: string; fullName?: string; role?: AppRole }
    | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const username = body?.username?.trim().toLowerCase() ?? "";
  const fullName = body?.fullName?.trim() ?? "";
  const role = body?.role ?? "viewer";
  if (!email.includes("@") || !/^[a-z0-9._-]{3,40}$/.test(username)) {
    return NextResponse.json({ error: "Enter a valid email and username." }, { status: 400 });
  }
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (role === "super_admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Only a super administrator can invite another super administrator." }, { status: 403 });
  }

  const admin = createAdminClient();
  const origin = new URL(request.url).origin;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { username, full_name: fullName, requested_role: role },
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Invitation could not be created." }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    email,
    username,
    full_name: fullName,
    role,
    is_active: true
  });
  if (profileError) {
    return NextResponse.json({ error: "The invitation was sent, but the profile requires administrator review." }, { status: 409 });
  }


  const { error: membershipError } = await admin.from("project_members").upsert({
    project_id: projectId,
    user_id: data.user.id,
    role
  });
  if (membershipError) {
    return NextResponse.json({ error: "The invitation was sent, but project access requires administrator review." }, { status: 409 });
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    event_type: "user.invited",
    entity_type: "profile",
    entity_id: data.user.id,
    project_id: projectId,
    details: { email, username, role }
  });
  return NextResponse.json({ ok: true });
}
