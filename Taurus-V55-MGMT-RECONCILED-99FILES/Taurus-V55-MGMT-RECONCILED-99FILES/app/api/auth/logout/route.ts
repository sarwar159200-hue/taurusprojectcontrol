import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAuthorizedDataClient } from "@/lib/supabase/data";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultProjectId } from "@/lib/project";

export async function POST(request: Request) {
  if (isDemoMode) {
    const cookieStore = await cookies();
    cookieStore.delete("pc_demo_session");
  } else if (isSupabaseConfigured) {
    const user = await getCurrentUser();
    if (user) {
      const supabase = await createAuthorizedDataClient();
      await supabase.from("audit_log").insert({
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
