import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPublishedProjectUpdate } from "@/lib/published-data";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProjectId } from "@/lib/project";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/auth/update-password");

  // An Auth account alone never grants portal access. Accounts created outside
  // Taurus have no project membership and receive no project data/navigation.
  const projectId = getDefaultProjectId();
  if (projectId && user.role !== "super_admin") {
    const supabase = await createClient();
    const { data: hasAccess } = await supabase.rpc("has_project_access", { target_project_id: projectId });
    if (!hasAccess) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#071b2c", color: "white", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 620 }}>
            <h1 style={{ fontSize: "clamp(28px,5vw,54px)", margin: 0 }}>Be careful, I am watching you.</h1>
          </div>
        </main>
      );
    }
  }

  const update = await getPublishedProjectUpdate();
  const progressDataDate = String(update?.progressAnalysis?.summary?.dataDate ?? "").trim() || null;
  const scheduleDataDate = String(update?.scheduleAnalysis?.summary?.dataDate ?? "").trim() || null;
  return <AppShell user={user} progressDataDate={progressDataDate} scheduleDataDate={scheduleDataDate}>{children}</AppShell>;
}
