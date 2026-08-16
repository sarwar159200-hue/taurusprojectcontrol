import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { LanguageSwitcher } from "@/components/language-provider";
import { PRODUCT_NAME, PROJECT_NAME, isDemoMode } from "@/lib/config";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand">
          <div className="taurus-logo-wrap login-logo">
            <Image alt="Taurus" height={54} priority src="/taurus-logo.jpeg" width={216} />
          </div>
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
        <div className="login-language"><LanguageSwitcher /></div>
        {isDemoMode ? <div className="demo-banner">Local demo mode is active</div> : null}
        <LoginForm />
        <footer>Authorized project personnel only</footer>
      </section>
    </main>
  );
}
