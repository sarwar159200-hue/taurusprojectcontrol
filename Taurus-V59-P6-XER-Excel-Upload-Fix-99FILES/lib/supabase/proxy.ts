import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config";

export async function updateSession(request: NextRequest) {
  if (isDemoMode || !isSupabaseConfigured) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const { data } = await supabase.auth.getClaims();
  const issuedAt = Number(data?.claims?.iat ?? 0);
  const ageSeconds = issuedAt > 0 ? Math.floor(Date.now() / 1000) - issuedAt : 0;

  // Security policy: a login is valid for a maximum of eight hours.
  // This is an absolute session lifetime, not an inactivity timeout.
  if (issuedAt > 0 && ageSeconds >= 8 * 60 * 60) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", "session_expired");
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Remove every Supabase auth cookie so a refresh cannot revive the old session.
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith("sb-") || name.includes("auth-token")) redirectResponse.cookies.delete(name);
    });
    return redirectResponse;
  }

  return response;
}
