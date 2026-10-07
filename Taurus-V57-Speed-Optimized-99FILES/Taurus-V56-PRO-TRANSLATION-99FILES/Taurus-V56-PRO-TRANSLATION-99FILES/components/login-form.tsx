"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function LoginForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaGeneration, setCaptchaGeneration] = useState(0);
  const handleCaptcha = useCallback((token: string) => setCaptchaToken(token), []);
  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setCaptchaGeneration((value) => value + 1);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const endpoint = resetMode ? "/api/auth/reset" : "/api/auth/login";
    if (!captchaToken) {
      setBusy(false);
      setMessage(t("Complete the security verification, then try again."));
      return;
    }
    const payload = resetMode ? { email: identifier, captchaToken } : { identifier, password, captchaToken };
    let response: Response;
    let result: { error?: string; mustChangePassword?: boolean } = {};
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      result = (await response.json().catch(() => ({}))) as {
        error?: string;
        mustChangePassword?: boolean;
      };
    } catch {
      setBusy(false);
      resetCaptcha();
      setMessage(t("The request could not be completed. Please try again."));
      return;
    }

    setBusy(false);
    // Cloudflare Turnstile tokens are single-use. Always create a fresh widget/token
    // after an authentication request, whether Supabase accepts or rejects it.
    resetCaptcha();
    if (!response.ok) {
      const rawError = result.error ?? "The request could not be completed.";
      const captchaError = /captcha|timeout-or-duplicate/i.test(rawError);
      setMessage(t(captchaError
        ? "Security verification expired. A new verification is ready; please try again."
        : rawError));
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
      <TurnstileWidget key={captchaGeneration} onToken={handleCaptcha} />
      {message ? <div className="form-message">{message}</div> : null}
      <button className="primary-button login-button" disabled={busy || !captchaToken} type="submit">
        {busy ? t("Please wait…") : resetMode ? t("Send reset link") : t("Sign in securely")}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => {
          setResetMode((value) => !value);
          setMessage("");
          resetCaptcha();
        }}
      >
        {resetMode ? t("Return to sign in") : t("Forgot your password?")}
      </button>
    </form>
  );
}
