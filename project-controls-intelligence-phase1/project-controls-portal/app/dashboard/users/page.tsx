import { InviteUserForm } from "@/components/invite-user-form";
import { requireAdmin } from "@/lib/auth";

export default async function UsersPage() {
  await requireAdmin();
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">ACCESS CONTROL</span><h1>Invite and authorize users</h1><p>Users receive a secure email invitation and only see data permitted by their assigned role.</p></div></div>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">NEW USER</span><h2>Send an invitation</h2></div></div><InviteUserForm /></section>
      <section className="role-grid"><article><strong>Viewer</strong><span>Read published dashboards and permitted documents.</span></article><article><strong>Planner</strong><span>Review schedule and progress information.</span></article><article><strong>Document Controller</strong><span>Manage MDR data and document links.</span></article><article><strong>Project Administrator</strong><span>Validate, publish and manage project access.</span></article></section>
    </>
  );
}
