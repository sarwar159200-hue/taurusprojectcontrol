import { UpdatePasswordForm } from "@/components/update-password-form";
import { LanguageSwitcher } from "@/components/language-provider";
import { ThemeToggle } from "@/components/theme-provider";

export default function UpdatePasswordPage() {
  return (
    <main className="login-page simple-login">
      <section className="login-panel">
        <div className="login-controls"><ThemeToggle /><LanguageSwitcher /></div>
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
