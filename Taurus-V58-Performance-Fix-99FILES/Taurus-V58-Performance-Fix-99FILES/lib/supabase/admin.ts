import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseAdminKey();
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is not configured in Vercel.");
  }
  if (key === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || key.startsWith("sb_publishable_")) {
    throw new Error(
      "The Supabase admin environment variable contains a publishable key. Use the current project's sb_secret_ / service-role key instead."
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
    return "The Supabase server secret was rejected. In Vercel, set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) to the sb_secret_ / service-role key from the same Supabase project as NEXT_PUBLIC_SUPABASE_URL.";
  }
  return message || "The Supabase administration operation failed.";
}
