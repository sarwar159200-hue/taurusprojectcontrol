import { redirect } from "next/navigation";
import { UploadWorkbooks } from "@/components/upload-workbooks";
import { requireUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

export default async function ProjectAdministratorPage() {
  const user = await requireUser();
  if (!isAdminRole(user.role)) redirect("/dashboard/access-denied");
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">PROJECT ADMINISTRATION</span><h1>Project Administrator</h1><p>Publish controlled Excel updates and notify all active project users. This page is restricted to Super Admin and Project Administrator accounts.</p></div></div>
      <div className="workflow-steps"><div className="current"><i>1</i><span><strong>Upload</strong><small>Select controlled files</small></span></div><div><i>2</i><span><strong>Validate</strong><small>Review mapping and warnings</small></span></div><div><i>3</i><span><strong>Publish & Notify</strong><small>Release and communicate the update</small></span></div></div>
      <UploadWorkbooks canNotify />
    </>
  );
}
