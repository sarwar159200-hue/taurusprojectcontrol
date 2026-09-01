"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

export function LoginForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const endpoint = resetMode ? "/api/auth/reset" : "/api/auth/login";
    const payload = resetMode ? { email: identifier } : { identifier, password };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      mustChangePassword?: boolean;
    };
    setBusy(false);
    if (!response.ok) {
      setMessage(t(result.error ?? "The request could not be completed."));
      return;
    }
    if (resetMode) {
      setMessage(t("If the account exists, a secure reset link has been sent."));
      return;
    }
    router.push(result.mustChangePassword ? "/auth/update-password" : "/dashboard");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="form-heading">
        <span className="eyebrow">{t("SECURE PROJECT ACCESS")}</span>
        <h1>{resetMode ? t("Reset your password") : t("Welcome back")}</h1>
        <p>
          {resetMode
            ? t("Enter your registered email address.")
            : t("Sign in to access the latest controlled project information.")}
        </p>
      </div>
      <label>
        <span>{resetMode ? t("Email address") : t("Username or email")}</span>
        <input
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder={resetMode ? "name@company.com" : t("your.username")}
          required
        />
      </label>
      {!resetMode ? (
        <label>
          <span>{t("Password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            required
          />
        </label>
      ) : null}
      {message ? <div className="form-message">{message}</div> : null}
      <button className="primary-button login-button" disabled={busy} type="submit">
        {busy ? t("Please wait…") : resetMode ? t("Send reset link") : t("Sign in securely")}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => {
          setResetMode((value) => !value);
          setMessage("");
        }}
      >
        {resetMode ? t("Return to sign in") : t("Forgot your password?")}
      </button>
    </form>
  );
}
