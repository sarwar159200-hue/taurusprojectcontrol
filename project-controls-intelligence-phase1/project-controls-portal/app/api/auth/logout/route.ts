import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isDemoMode) {
    const cookieStore = await cookies();
    cookieStore.delete("pc_demo_session");
  } else if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
