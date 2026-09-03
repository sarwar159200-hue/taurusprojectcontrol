import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  if (isSupabaseAdminConfigured) {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    if (!error) return NextResponse.json({ ok: true });
  }

  const client = await createClient();
  const { error } = await client.rpc("touch_my_presence");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
