import type { AppRole } from "@/lib/types";

export const adminRoles: AppRole[] = ["super_admin", "project_admin"];

export function isAdminRole(role: AppRole) {
  return adminRoles.includes(role);
}


const USER_CREATOR_EMAILS = new Set([
  "sarwar.khalid@miranenergy.com",
  "saman.tohidi@taurusenergy.com"
]);
const PAYMENT_UPLOAD_EMAILS = new Set([
  "sarwar.khalid@miranenergy.com",
  "saiwan.salih@taurusenergy.com"
]);

export function canCreateUsersByEmail(email: string) {
  return USER_CREATOR_EMAILS.has(email.trim().toLowerCase());
}

export function canUploadPaymentsByEmail(email: string) {
  return PAYMENT_UPLOAD_EMAILS.has(email.trim().toLowerCase());
}

export function canGrantPaymentAccess(email: string) {
  return email.trim().toLowerCase() === "sarwar.khalid@miranenergy.com";
}
