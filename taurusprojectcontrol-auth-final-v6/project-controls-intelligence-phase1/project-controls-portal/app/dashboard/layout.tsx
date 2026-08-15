import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPublishedProjectUpdate } from "@/lib/published-data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/auth/update-password");
  const update = await getPublishedProjectUpdate();
  return <AppShell user={user} dataDate={update?.dataDate}>{children}</AppShell>;
}
