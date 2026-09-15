import { requireSection } from "@/lib/auth";
import { canUploadPaymentsByEmail } from "@/lib/roles";

export default async function PaymentsPage() {
  const user = await requireSection("payments");
  const canUpload = canUploadPaymentsByEmail(user.email);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">RESTRICTED COMMERCIAL AREA</span>
          <h1>Payments</h1>
          <p>Payment information is isolated from the general project-control workspace.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">FUTURE MODULE</span><h2>Payment control workspace</h2></div>
          <span className="status-pill status-ready">Restricted access</span>
        </div>
        <p>This module is reserved for the future payment register and payment Excel workflow.</p>
        <p><strong>{canUpload ? "You are authorized to upload payment Excel files when the payment importer is enabled." : "View access only. Payment Excel upload is restricted."}</strong></p>
      </section>
    </>
  );
}
