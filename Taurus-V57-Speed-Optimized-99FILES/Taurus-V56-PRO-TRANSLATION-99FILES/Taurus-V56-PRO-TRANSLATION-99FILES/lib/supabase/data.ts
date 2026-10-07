import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-only database client for an operation that has already completed its
 * user and section-permission checks. The service client avoids deployment
 * failures caused by a missing optional RLS upgrade, while the signed-in
 * client remains a safe fallback for read-only installations.
 */
export async function createAuthorizedDataClient() {
  return isSupabaseAdminConfigured ? createAdminClient() : createClient();
}
