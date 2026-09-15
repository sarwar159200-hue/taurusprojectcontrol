import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPublishedProjectUpdate } from "@/lib/published-data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, update] = await Promise.all([
    requireUser(),
    getPublishedProjectUpdate()
  ]);
  if (user.mustChangePassword) redirect("/auth/update-password");
  const progressDataDate = String(update?.progressAnalysis?.summary?.dataDate ?? "").trim() || null;
  const scheduleDataDate = String(update?.scheduleAnalysis?.summary?.dataDate ?? "").trim() || null;
  return <AppShell user={user} progressDataDate={progressDataDate} scheduleDataDate={scheduleDataDate}>{children}</AppShell>;
}
