import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { getDefaultProjectId } from "@/lib/project";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    event_type: "auth.password_changed",
    entity_type: "profile",
    entity_id: user.id,
    project_id: getDefaultProjectId(),
    details: {}
  });
  return NextResponse.json({ ok: true });
}
