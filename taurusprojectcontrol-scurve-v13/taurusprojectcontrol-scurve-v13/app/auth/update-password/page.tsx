import { UpdatePasswordForm } from "@/components/update-password-form";
import { LanguageSwitcher } from "@/components/language-provider";

export default function UpdatePasswordPage() {
  return (
    <main className="login-page simple-login">
      <section className="login-panel">
        <div className="login-language"><LanguageSwitcher /></div>
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
