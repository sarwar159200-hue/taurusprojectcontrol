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
  const headers = ["Document No.", "Title", "System / Division", "Document Type", "Discipline", "Revision", "Purpose", "First ENKA Submission", "Latest ENKA Submission", "Latest Taurus Response", "Status", "Current Action", "Responsible Party", "Contractual Due Date", "Review Cycle Days", "Overdue Days", "Total Running Days", "Hold by Taurus", "Hold by ENKA", "Delay Analysis", "Transmittal No.", "Transmittal Date", "File URL"];
  const rows = documents.map((row) => [row.documentNo, row.title, row.systemDivision, row.documentType, row.discipline, row.revision, row.purpose, row.firstSubmissionDate, row.lastSubmissionDate, row.lastResponseDate, row.lastStatus, row.currentAction, row.responsibleParty, row.dueDate, row.reviewCycleDays, row.overdueDays, row.totalRunningDays, row.holdByTaurusDays, row.holdByEnkaDays, row.delayAnalysis, row.transmittalNo, row.transmittalDate, row.driveWebUrl]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=taurus-document-register.csv"
    }
  });
}
