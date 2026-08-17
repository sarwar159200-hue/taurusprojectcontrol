import { DocumentControlCommandCenter } from "@/components/document-control-command-center";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate } from "@/lib/published-data";

export const dynamic = "force-dynamic";

export default async function DocumentControlPage() {
  await requireSection("document_control");
  const update = await getPublishedProjectUpdate({ documents: true });
  return <DocumentControlCommandCenter dataDate={update?.dataDate} documents={update?.progressAnalysis?.documents ?? []} />;
}
