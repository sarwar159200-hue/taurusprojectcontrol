import { DocumentControlCommandCenter } from "@/components/document-control-command-center";
import { requireSection } from "@/lib/auth";
import { getPublishedProjectUpdate } from "@/lib/published-data";


export default async function DocumentControlPage() {
  const [, update] = await Promise.all([
    requireSection("document_control"),
    getPublishedProjectUpdate({ documents: true })
  ]);
  return <DocumentControlCommandCenter dataDate={update?.dataDate} documents={update?.progressAnalysis?.documents ?? []} />;
}
