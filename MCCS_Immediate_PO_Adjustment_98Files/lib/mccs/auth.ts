import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function requireUser() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export const MCCS_OWNER_EMAIL = "sarwar.khalid@miranenergy.com";
export const MCCS_SECURITY_EMAILS = ["sarwar.159200@gmail.com", MCCS_OWNER_EMAIL] as const;
export const MCCS_SECURITY_WHATSAPP = "9647701084299";

export function isMccsOwner(email?: string | null) {
  return String(email || "").trim().toLowerCase() === MCCS_OWNER_EMAIL;
}

export async function isMccsAuthorizedUser(userId: string, email?: string | null) {
  if (isMccsOwner(email)) return true;
  try {
    const admin = adminClient();
    const { data, error } = await admin.from("mccs_authorized_users").select("user_id").eq("user_id", userId).maybeSingle();
    if (error) { console.error("MCCS authorization check failed:", error.message); return false; }
    return Boolean(data?.user_id);
  } catch (error) {
    console.error("MCCS authorization check failed:", error);
    return false;
  }
}

export async function requireSuperAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
  if (!isMccsOwner(user.email) || profile?.is_active === false) throw new Error("MCCS Owner permission is required.");
  return { supabase, user };
}

export function mccsAppUrl() {
  const explicit = String(process.env.NEXT_PUBLIC_APP_URL || process.env.MCCS_APP_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "";
}

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function brevoEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.MCCS_EMAIL_FROM);
}

function parseSender(value: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) return { name: match[1].trim() || "MCCS – Miran Energy", email: match[2].trim() };
  return { name: "MCCS – Miran Energy", email: raw };
}

export async function sendMccsEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  const sender = parseSender(String(process.env.MCCS_EMAIL_FROM || ""));
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured in Vercel.");
  if (!sender.email) throw new Error("MCCS_EMAIL_FROM is not configured in Vercel.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Brevo could not send the email (${response.status}). ${text.slice(0, 400)}`);
    }
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Brevo email request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendSecurityNotification(input: { subject: string; html: string }) {
  const results = await Promise.allSettled(MCCS_SECURITY_EMAILS.map((to) => sendMccsEmail({ to, subject: input.subject, html: input.html })));
  const failed = results.filter((x) => x.status === "rejected");
  if (failed.length) console.error("MCCS security email warning:", failed);
}

export function whatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendMccsWhatsApp(message: string) {
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneNumberId) return { sent: false, reason: "WhatsApp Cloud API is not configured." };
  const template = String(process.env.WHATSAPP_TEMPLATE_NAME || "").trim();
  const language = String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US").trim();
  const body: any = template
    ? { messaging_product: "whatsapp", to: MCCS_SECURITY_WHATSAPP, type: "template", template: { name: template, language: { code: language }, components: [{ type: "body", parameters: [{ type: "text", text: message.slice(0, 900) }] }] } }
    : { messaging_product: "whatsapp", to: MCCS_SECURITY_WHATSAPP, type: "text", text: { preview_url: false, body: message.slice(0, 3500) } };
  const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!response.ok) { const text = await response.text(); console.error("MCCS WhatsApp warning:", response.status, text.slice(0, 500)); return { sent: false, reason: `WhatsApp API ${response.status}` }; }
  return { sent: true };
}

/** UI permission check; server actions must independently authorize writes. */
export async function canManageCommercial(s: Awaited<ReturnType<typeof createClient>>):Promise<boolean>{
 if(!s)return false;
 const {data:{user}}=await s.auth.getUser();if(!user)return false;
 const {data:profile}=await s.from("profiles").select("is_super_admin").eq("id",user.id).maybeSingle();
 if(profile?.is_super_admin)return true;
 const {data:assigned}=await s.from("user_roles").select("role_id").eq("user_id",user.id);
 const ids=(assigned||[]).map((r:any)=>r.role_id);if(!ids.length)return false;
 const {data:roles}=await s.from("roles").select("role_code").in("id",ids);
 return (roles||[]).some((r:any)=>["admin","administrator","super_admin"].includes(String(r.role_code||"").toLowerCase()));
}
