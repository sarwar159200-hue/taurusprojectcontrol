import { getCurrentUser } from "@/lib/auth";
import { canAccessSection } from "@/lib/permissions";
import { getPublishedProjectUpdate } from "@/lib/published-data";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Authentication required.", { status: 401 });
  if (!canAccessSection(user, "document_control")) return new Response("Access denied.", { status: 403 });
  const update = await getPublishedProjectUpdate({ documents: true });
  const documents = update?.progressAnalysis?.documents ?? [];
  const headers = ["Document No.", "Title", "Discipline", "Sub-discipline", "Revision", "Status", "Current Action", "Overdue Days", "File URL"];
  const rows = documents.map((row) => [row.documentNo, row.title, row.discipline, row.subdiscipline, row.revision, row.lastStatus, row.currentAction, row.overdueDays, row.driveWebUrl]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=taurus-document-register.csv"
    }
  });
}
