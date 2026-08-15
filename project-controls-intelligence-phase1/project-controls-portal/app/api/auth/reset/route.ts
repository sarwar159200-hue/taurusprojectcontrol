import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter your registered email address." }, { status: 400 });
  }
  if (isDemoMode || !isSupabaseConfigured) {
    return NextResponse.json({ error: "Password reset is available after Supabase is connected." }, { status: 503 });
  }

  const supabase = await createClient();
  const origin = new URL(request.url).origin;
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`
  });
  return NextResponse.json({ ok: true });
}
