import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json({ ok: true });
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
