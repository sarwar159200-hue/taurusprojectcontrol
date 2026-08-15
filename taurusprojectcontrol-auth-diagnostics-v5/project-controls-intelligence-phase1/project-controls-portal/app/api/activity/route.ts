import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { getDefaultProjectId } from "@/lib/project";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedPaths = new Set([
  "/dashboard",
  "/dashboard/document-control",
  "/dashboard/progress",
  "/dashboard/schedule",
  "/dashboard/admin/imports",
  "/dashboard/users",
  "/dashboard/activity"
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isSupabaseAdminConfigured) return NextResponse.json({ ok: false }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { path?: string } | null;
  const path = body?.path ?? "";
  if (!allowedPaths.has(path)) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: user.id,
    event_type: "page.viewed",
    entity_type: "page",
    entity_id: path,
    project_id: getDefaultProjectId(),
    details: { path, actor_name: user.fullName, actor_email: user.email }
  });
  return NextResponse.json({ ok: true });
}
