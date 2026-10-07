"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";

export function UpdatePasswordForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setMessage(t("Use 12+ characters with uppercase, lowercase, a number and a symbol."));
      return;
    }
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setMessage(t(error.message));
      return;
    }
    const response = await fetch("/api/auth/password-changed", { method: "POST" });
    if (!response.ok) {
      setBusy(false);
      setMessage(t("The password changed, but the account status could not be updated. Contact the administrator."));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="form-heading">
        <span className="eyebrow">{t("ACCOUNT SECURITY")}</span>
        <h1>{t("Create a new password")}</h1>
        <p>{t("Use a strong password that is unique to this portal.")}</p>
      </div>
      <label>
        <span>{t("New password")}</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={12}
          required
        />
      </label>
      {message ? <div className="form-message">{message}</div> : null}
      <button className="primary-button login-button" disabled={busy} type="submit">
        {busy ? t("Updating…") : t("Update password")}
      </button>
    </form>
  );
}
