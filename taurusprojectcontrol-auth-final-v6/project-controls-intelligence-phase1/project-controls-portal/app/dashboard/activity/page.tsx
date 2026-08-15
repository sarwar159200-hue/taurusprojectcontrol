import { listActivityEntries, type ActivityEntry } from "@/lib/admin/activity";
import { requireSection } from "@/lib/auth";
import { isSupabaseAdminConfigured } from "@/lib/config";

const eventLabels: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.password_changed": "Changed password",
  "page.viewed": "Viewed page",
  "user.created": "Created user",
  "user.permissions_updated": "Updated user access",
  "user.temporary_password_reset": "Issued temporary password",
  "user.deleted": "Removed user",
  "user.invited": "Invited user",
  "import.previewed": "Validated workbook"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Baghdad"
  }).format(new Date(value));
}

function summarizeDetails(details: Record<string, unknown>) {
  const preferred = ["path", "file_name", "email", "username", "role", "method"];
  const parts = preferred
    .filter((key) => details[key] !== undefined)
    .map((key) => `${key.replaceAll("_", " ")}: ${String(details[key])}`);
  return parts.length ? parts.join(" · ") : "No additional details";
}

export default async function ActivityPage() {
  await requireSection("activity_log");
  let activities: ActivityEntry[] = [];
  let loadError = "";
  if (isSupabaseAdminConfigured) {
    try {
      activities = await listActivityEntries();
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Activity could not be loaded.";
    }
  } else {
    loadError = "Add SUPABASE_SERVICE_ROLE_KEY to Vercel to enable the activity log.";
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">AUDIT & GOVERNANCE</span>
          <h1>User activity log</h1>
          <p>Review sign-ins, page access, password events and all user-administration changes.</p>
        </div>
        <span className="status-pill status-ready">Baghdad time</span>
      </div>
      {loadError ? <div className="validation-error">{loadError}</div> : null}
      <section className="panel activity-panel">
        <div className="panel-heading"><div><span className="eyebrow">LATEST EVENTS</span><h2>Most recent 200 activities</h2></div></div>
        <div className="responsive-table">
          <table className="activity-table">
            <thead><tr><th>Date and time</th><th>User</th><th>Activity</th><th>Details</th></tr></thead>
            <tbody>
              {activities.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.createdAt)}</td>
                  <td><strong>{entry.actorName}</strong><small>{entry.actorEmail}</small></td>
                  <td><span className="activity-event">{eventLabels[entry.eventType] ?? entry.eventType}</span></td>
                  <td>{summarizeDetails(entry.details)}</td>
                </tr>
              ))}
              {!activities.length ? <tr><td className="empty-table-cell" colSpan={4}>No recorded activities yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
