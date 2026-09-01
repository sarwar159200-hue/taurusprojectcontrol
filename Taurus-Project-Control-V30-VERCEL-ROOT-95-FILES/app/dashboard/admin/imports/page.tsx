import { UploadWorkbooks } from "@/components/upload-workbooks";
import { requireSection } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

export default async function ImportPage() {
  const user = await requireSection("imports", "manage");
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>Import and validate project data</h1><p>Upload controlled Excel updates, review the validation result, then publish one complete version.</p></div></div>
      <div className="workflow-steps"><div className="current"><i>1</i><span><strong>Upload</strong><small>Select controlled files</small></span></div><div><i>2</i><span><strong>Validate</strong><small>Review mapping and warnings</small></span></div><div><i>3</i><span><strong>Publish</strong><small>Release to authorized users</small></span></div></div>
      <UploadWorkbooks canNotify={isAdminRole(user.role)} />
    </>
  );
}
