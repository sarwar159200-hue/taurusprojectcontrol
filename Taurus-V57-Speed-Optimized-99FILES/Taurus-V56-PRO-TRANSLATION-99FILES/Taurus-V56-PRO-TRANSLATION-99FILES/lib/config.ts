export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export const isSupabaseAdminConfigured = Boolean(
  isSupabaseConfigured && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
);

export const PROJECT_NAME = "Bazian II Power Plant Conversion Project";
export const PRODUCT_NAME = "Taurus Project Control";
