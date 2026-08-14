import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { PRODUCT_NAME, PROJECT_NAME, isDemoMode } from "@/lib/config";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand">
          <div className="brand-mark large"><span>P</span>C</div>
          <div>
            <strong>{PRODUCT_NAME}</strong>
            <small>PROJECT ASSURANCE PLATFORM</small>
          </div>
        </div>
        <div className="login-story">
          <span className="eyebrow light">ONE CONTROLLED SOURCE OF TRUTH</span>
          <h2>Turn every project update into a management decision.</h2>
          <p>{PROJECT_NAME}</p>
          <div className="login-features">
            <span><i>✓</i> Document control</span>
            <span><i>✓</i> Dynamic S-curves</span>
            <span><i>✓</i> Integrated schedule</span>
          </div>
        </div>
        <div className="login-visual-footer">SECURE • VERSIONED • AUDITABLE</div>
      </section>
      <section className="login-panel">
        {isDemoMode ? <div className="demo-banner">Local demo mode is active</div> : null}
        <LoginForm />
        <footer>Authorized project personnel only</footer>
      </section>
    </main>
  );
}
