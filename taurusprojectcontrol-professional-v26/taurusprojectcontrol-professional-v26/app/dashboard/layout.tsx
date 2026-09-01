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
  return <AppShell user={user} dataDate={update?.dataDate}>{children}</AppShell>;
}
