import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel.");
  }
  if (key === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY contains a publishable key. Copy the current project's sb_secret_ key from Supabase API Keys."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function friendlyAdminError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  if (/api key|not allowed|permission|unauthor|jwt|service role|secret/i.test(message)) {
    return "The Supabase server secret was rejected. In Vercel, SUPABASE_SERVICE_ROLE_KEY must be the sb_secret_ key from the same project as NEXT_PUBLIC_SUPABASE_URL.";
  }
  return message || "The Supabase administration operation failed.";
}
