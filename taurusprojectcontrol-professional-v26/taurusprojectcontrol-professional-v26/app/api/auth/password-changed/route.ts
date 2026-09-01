import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultProjectId } from "@/lib/project";
import { createAuthorizedDataClient } from "@/lib/supabase/data";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const dataClient = await createAuthorizedDataClient();
  const { error } = await dataClient.from("profiles").update({
    must_change_password: false,
    updated_at: new Date().toISOString()
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await dataClient.from("audit_log").insert({
    actor_id: user.id,
    event_type: "auth.password_changed",
    entity_type: "profile",
    entity_id: user.id,
    project_id: getDefaultProjectId(),
    details: {}
  });
  return NextResponse.json({ ok: true });
}
