import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import type { SectionKey } from "@/lib/types";

const destinations: Array<{ section: SectionKey; href: string; label: string }> = [
  { section: "overview", href: "/dashboard", label: "Executive overview" },
  { section: "document_control", href: "/dashboard/document-control", label: "Document control" },
  { section: "progress", href: "/dashboard/progress", label: "Progress & S-curves" },
  { section: "schedule", href: "/dashboard/schedule", label: "Project schedule" },
  { section: "imports", href: "/dashboard/admin/imports", label: "Import & publish" },
  { section: "user_access", href: "/dashboard/users", label: "User access" },
  { section: "activity_log", href: "/dashboard/activity", label: "Activity log" }
];

export default async function AccessDeniedPage() {
  const user = await requireUser();
  const destination = destinations.find((item) => canAccessSection(user, item.section));
  return (
    <section className="panel access-denied-panel">
      <span className="eyebrow">ACCESS CONTROL</span>
      <h1>Permission required</h1>
      <p>Your account does not currently have access to this section. Ask a Taurus Project Control administrator to update your permissions.</p>
      {destination ? <Link className="primary-button inline-button" href={destination.href}>Open {destination.label}</Link> : null}
    </section>
  );
}
