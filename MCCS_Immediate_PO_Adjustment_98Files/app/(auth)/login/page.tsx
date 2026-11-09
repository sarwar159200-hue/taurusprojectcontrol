"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState, useRef, useEffect, useCallback } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";


type CaptchaHandle = { reset: () => void };
export function MccsCaptcha({ onToken, resetRef }: {
  onToken: (token: string) => void;
  resetRef: React.RefObject<CaptchaHandle | null>;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [status, setStatus] = useState("Loading security check…");
  useEffect(() => {
    if (!siteKey) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const render = () => {
      if (disposed || !holder.current || widget.current !== null) return;
      const api = window.turnstile;
      if (!api) { retry = setTimeout(render, 100); return; }
      widget.current = api.render(holder.current, {
        sitekey: siteKey,
        callback: (token: string) => { onToken(token); setStatus(""); },
        "expired-callback": () => { onToken(""); setStatus("Security check expired. Please try again."); },
        "error-callback": () => { onToken(""); setStatus("Security check failed. Please retry."); },
      });
    };
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    script.onerror = () => setStatus("Unable to load security check.");
    document.head.appendChild(script);
    render();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
      script.remove();
    };
  }, [siteKey, onToken]);
  useEffect(() => {
    if (resetRef) resetRef.current = {
      reset: () => {
        onToken("");
        setStatus("Complete the security check again.");
        if (widget.current !== null) window.turnstile?.reset(widget.current);
      },
    };
    return () => { if (resetRef) resetRef.current = null; };
  }, [resetRef, onToken]);
  if (!siteKey) return null;
  return <div><div ref={holder} /><p className="text-xs text-slate-500" role="status">{status}</p></div>;
}
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

export default function LoginPage() {
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<CaptchaHandle | null>(null);
  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState("");
  const [mfaMode, setMfaMode] = useState<"none" | "enroll" | "challenge">("none");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaQr, setMfaQr] = useState("");

  const beginMfa = useCallback(async () => {
    const supabase = createClient();
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const verified = factors.totp.find((f) => f.status === "verified");
    if (verified) {
      setMfaFactorId(verified.id);
      setMfaMode("challenge");
      setLoginStatus("");
      return;
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "MCCS Authenticator" });
    if (enrollError) throw enrollError;
    setMfaFactorId(data.id);
    setMfaQr(data.totp.qr_code);
    setMfaMode("enroll");
    setLoginStatus("");
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) beginMfa().catch(() => undefined);
    });
  }, [beginMfa]);

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(mfaCode.trim())) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setLoading(true);
    setLoginStatus("Verifying two-factor authentication…");
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode.trim() });
      if (verifyError) { setError("Invalid or expired authentication code. Please try again."); return; }
      window.location.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify two-factor authentication.");
    } finally { setLoading(false); setLoginStatus(""); }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (captchaEnabled && !captchaToken) {
      setError("Complete the security check first.");
      return;
    }
    setLoading(true);

    try {
      const supabase = createClient();

      setLoginStatus("Signing in securely…");
      let response = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: captchaEnabled ? { captchaToken } : undefined,
      });

      // Retry once only for transient transport/server failures. Do not retry
      // rejected credentials, which would just add delay and can trigger rate limits.
      if (!captchaEnabled && response.error && /fetch|network|timeout|502|503|504/i.test(response.error.message)) {
        setLoginStatus("Connection was interrupted. Retrying…");
        await new Promise((resolve) => setTimeout(resolve, 500));
        response = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      }

      const { error } = response;
      if (error) {
        captchaRef.current?.reset();
        const normalized = error.message.toLowerCase();
        if (normalized.includes("invalid login credentials")) {
          setError(
            "Wrong email or password."
          );
        } else if (normalized.includes("email not confirmed")) {
          setError(
            "This user exists, but the email is not confirmed yet. Confirm the user in Supabase Authentication."
          );
        } else {
          setError(error.message);
        }
        return;
      }

      if (!rememberMe) {
        // Session lifecycle is still handled securely by Supabase.
      }

      setLoginStatus("Preparing two-factor authentication…");
      await beginMfa();
    } catch (err) {
      captchaRef.current?.reset();
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please contact the MCCS administrator."
      );
    } finally {
      setLoading(false);
      setLoginStatus("");
    }
  }

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-[#07111f]">
      <div className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(30,64,175,.30), transparent 32%), radial-gradient(circle at 85% 80%, rgba(249,115,22,.15), transparent 28%)",
        }}
      />

      <div className="relative grid min-h-[100dvh] w-full lg:grid-cols-[1.08fr_.92fr]">

          <section className="relative hidden min-h-[690px] overflow-hidden bg-[#f8fafc] p-12 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
            <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-orange-100/50 blur-3xl" />

            <div className="relative">
              <Image
                src="/miran-energy-logo.png"
                alt="Miran Energy LTD"
                width={420}
                height={130}
                priority
                className="h-auto w-full max-w-[390px] object-contain"
              />
            </div>

            <div className="relative max-w-[520px]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-blue-700" />
                Internal Commercial Platform
              </div>

              <h1 className="text-[42px] font-bold leading-[1.08] tracking-[-0.035em] text-slate-950">
                Commercial control with
                <span className="block text-blue-800">clarity and governance.</span>
              </h1>

              <p className="mt-6 max-w-[500px] text-[16px] leading-7 text-slate-600">
                A governed workspace for contracts, commitments, purchase orders,
                payment milestones, invoice assurance, approvals and payment control.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                {[
                  ["PO & Contract Control", "Commitments and revisions"],
                  ["Invoice Assurance", "Controlled verification"],
                  ["Payment Milestones", "Due-date visibility"],
                  ["Audit Trail", "Transparent accountability"],
                ].map(([title, sub]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
                    <div className="text-sm font-bold text-slate-900">{title}</div>
                    <div className="mt-1 text-xs text-slate-500">{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-center justify-between text-xs text-slate-500">
              <span>MCCS • Miran Commercial Control System</span>
              <span>Authorized access only</span>
            </div>
          </section>

          <section className="flex min-h-[690px] items-center bg-white p-7 sm:p-10 lg:p-14">
            <div className="mx-auto w-full max-w-[430px]">
              <div className="mb-8 lg:hidden">
                <Image
                  src="/miran-energy-logo.png"
                  alt="Miran Energy LTD"
                  width={310}
                  height={100}
                  priority
                  className="h-auto w-full max-w-[270px] object-contain"
                />
              </div>

              <div className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue-800">
                MCCS
              </div>

              <h2 className="mt-5 text-[34px] font-bold tracking-[-0.03em] text-slate-950">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to your Miran Commercial Control System workspace.
              </p>

              {mfaMode !== "none" ? (
                <form className="mt-9 space-y-5" onSubmit={verifyMfa}>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
                    <div className="font-bold text-slate-950">Two-factor authentication required</div>
                    <p className="mt-1">{mfaMode === "enroll" ? "Scan this QR code once with Google Authenticator, Microsoft Authenticator, 1Password, or another authenticator app. Then enter the 6-digit code." : "Enter the 6-digit code from your authenticator app to continue to MCCS."}</p>
                  </div>
                  {mfaMode === "enroll" && mfaQr ? (
                    <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-4">
                      <img src={mfaQr} alt="MCCS two-factor authentication QR code" className="h-48 w-48" />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Authenticator code</label>
                    <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-center text-xl font-bold tracking-[.35em] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" required />
                  </div>
                  {loading && loginStatus ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">{loginStatus}</div> : null}
                  {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                  <button disabled={loading || mfaCode.length !== 6} className="flex w-full items-center justify-center rounded-xl bg-[#07111f] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60" type="submit">{loading ? "Verifying..." : mfaMode === "enroll" ? "Enable 2FA & Continue" : "Verify & Continue"}</button>
                  <button type="button" onClick={async () => { await createClient().auth.signOut(); setMfaMode("none"); setMfaCode(""); setMfaQr(""); setMfaFactorId(""); }} className="w-full text-sm font-bold text-blue-700">Use another account</button>
                </form>
              ) : (
              <form className="mt-9 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label className="block text-sm font-bold text-slate-700">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-bold text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-12 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Keep me signed in on this device
                </label>

                <MccsCaptcha onToken={onCaptcha} resetRef={captchaRef} />

                {loading && loginStatus ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700">
                    {loginStatus}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  disabled={loading || (captchaEnabled && !captchaToken)}
                  className="flex w-full items-center justify-center rounded-xl bg-[#07111f] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                >
                  {loading ? "Signing in..." : "Sign in to MCCS"}
                </button>
              </form>
              )}

              <div className="mt-7 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <p className="text-xs leading-5 text-slate-500">
                  Access is restricted to authorized Miran Energy personnel. Sign-in and recovery are handled through secure Supabase authentication.
                </p>
              </div>

              <p className="mt-7 text-center text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Miran Energy LTD • Internal
              </p>
            </div>
          </section>
      </div>
    </main>
  );
}
