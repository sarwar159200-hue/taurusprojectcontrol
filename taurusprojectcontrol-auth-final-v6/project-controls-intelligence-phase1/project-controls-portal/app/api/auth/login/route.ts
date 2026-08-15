import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProjectId } from "@/lib/project";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { identifier?: string; password?: string }
    | null;
  const identifier = body?.identifier?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  if (!identifier || !password) {
    return NextResponse.json({ error: "Enter your username/email and password." }, { status: 400 });
  }

  if (isDemoMode) {
    const demoEmail = process.env.DEMO_ADMIN_EMAIL?.toLowerCase();
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
    const acceptedIdentifier = identifier === demoEmail || identifier === "admin";
    if (!demoEmail || !demoPassword || !acceptedIdentifier || password !== demoPassword) {
      return NextResponse.json({ error: "Invalid demo credentials." }, { status: 401 });
    }
    const cookieStore = await cookies();
    cookieStore.set("pc_demo_session", "active", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8
    });
    return NextResponse.json({ ok: true, mustChangePassword: false });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase has not been configured." }, { status: 503 });
  }

  let email = identifier;
  if (!identifier.includes("@")) {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json({ error: "Username login is not configured." }, { status: 503 });
    }
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("email, is_active")
      .eq("username", identifier)
      .maybeSingle();
    if (!data?.email || !data.is_active) {
      return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
    }
    email = data.email;
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !signInData.user) {
    const configurationError = error?.message?.toLowerCase().includes("api key") ||
      error?.message?.toLowerCase().includes("project") ||
      error?.message?.toLowerCase().includes("fetch");
    return NextResponse.json(
      { error: configurationError ? `Supabase configuration error: ${error?.message}` : (error?.message ?? "Invalid login details.") },
      { status: configurationError ? 503 : 401 }
    );
  }

  let mustChangePassword = false;
  // Read the signed-in user's own profile through RLS. Login must never depend
  // on the service-role key, which is reserved for administration operations.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active, must_change_password")
    .eq("id", signInData.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: `Account profile could not be verified: ${profileError?.message ?? "profile not found"}` },
      { status: 403 }
    );
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "This account has been disabled." }, { status: 403 });
  }
  mustChangePassword = Boolean(profile.must_change_password);

  // Activity metadata is best-effort and must not block a valid login.
  if (isSupabaseAdminConfigured) {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin.from("profiles").update({ last_login_at: now }).eq("id", signInData.user.id);
    await admin.from("audit_log").insert({
      actor_id: signInData.user.id,
      event_type: "auth.login",
      entity_type: "profile",
      entity_id: signInData.user.id,
      project_id: getDefaultProjectId(),
      details: {
        method: identifier.includes("@") ? "email" : "username",
        actor_name: signInData.user.user_metadata?.full_name ?? email.split("@")[0],
        actor_email: email
      }
    });
  }
  return NextResponse.json({ ok: true, mustChangePassword });
}
