import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultProjectId } from "@/lib/project";

export async function POST(request: Request) {
  if (isDemoMode) {
    const cookieStore = await cookies();
    cookieStore.delete("pc_demo_session");
  } else if (isSupabaseConfigured) {
    const user = await getCurrentUser();
    if (user && isSupabaseAdminConfigured) {
      const admin = createAdminClient();
      await admin.from("audit_log").insert({
        actor_id: user.id,
        event_type: "auth.logout",
        entity_type: "profile",
        entity_id: user.id,
        project_id: getDefaultProjectId(),
        details: { actor_name: user.fullName, actor_email: user.email }
      });
    }
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
